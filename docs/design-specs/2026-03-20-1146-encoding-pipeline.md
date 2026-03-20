# Encoding Pipeline

**Created:** 2026-03-20 **Implementation Plan:** TBD

**Parent Spec:** [Video Encoder App](./2026-03-19-1623-video-encoder-app.md) (Phase 2)

---

## Overview

**What:** Parallel FFmpeg encoding with real-time progress streaming via SSE and file download endpoints, building on the Phase 1 server foundation.

**Why:** Phase 1 established the server scaffolding (upload, job tracking, FFmpeg wrapper, presets). This phase wires those pieces into a working pipeline so that an uploaded video is encoded into AV1 + H.264, progress is streamed to the client in real time, and the output files can be downloaded.

**Type:** Feature

---

## Requirements

### Must Have

- [ ] `ffprobe` duration probing before encoding starts
- [ ] FFmpeg progress parsing via `-progress pipe:1` stdout output
- [ ] Parallel AV1 + H.264 encoding via `Promise.allSettled`
- [ ] Per-output progress tracking (each encoding tracks its own status and percentage)
- [ ] Combined progress calculation (average of all output percentages)
- [ ] SSE endpoint (`GET /api/encode/:jobId/progress`) for real-time progress streaming
- [ ] SSE snapshot on connect (current state sent immediately, handles reconnect and late connect)
- [ ] Download endpoint (`GET /api/encode/:jobId/download/:suffix`) for encoded files
- [ ] Downloaded files named `{originalName}--{suffix}.mp4`
- [ ] Partial success: job is `done` if at least one encoding succeeds, `error` only if all fail
- [ ] Upload route accepts `presetId` in form data, defaults to `"header-video"`
- [ ] Upload route captures original filename for download naming
- [ ] Error handling for ffprobe failure, FFmpeg failure, invalid job ID, and invalid download suffix

### Nice to Have

- [ ] Per-output progress breakdown sent over SSE (in addition to combined progress)

### Out of Scope

- Concurrency limits / job queuing
- Killing FFmpeg processes on client disconnect
- Frontend / client-side UI (Phase 3)
- Authentication

---

## Design Decisions

### Encoding Lifecycle: Upload Triggers Encoding vs SSE Triggers Encoding

**Options considered:**

1. **Upload triggers encoding** — `POST /api/encode` saves the file, kicks off encoding, returns `{ jobId }` immediately. SSE is a read-only observer.
2. **SSE triggers encoding** — Upload saves file and returns `{ jobId }` with status `pending`. Encoding starts when the client opens the SSE connection.

**Decision:** Option 1. Encoding begins immediately with no dependency on the client connecting. The SSE endpoint is simpler (read-only) and reconnect semantics are straightforward. Option 2 adds latency, muddies the SSE endpoint's responsibility, and creates awkward reconnect behavior (does reconnect re-trigger encoding?).

### Progress Architecture: Polling Job State vs EventEmitter vs Hybrid

**Options considered:**

1. **Job as state hub** — FFmpeg callbacks update the Job object. SSE endpoint polls Job on an interval (e.g., 500ms) and pushes to client.
2. **EventEmitter bridge** — Each job gets an EventEmitter. FFmpeg emits progress events; SSE subscribes and forwards. Job tracks final state only.
3. **Hybrid** — FFmpeg callbacks update the Job object AND emit on the EventEmitter. SSE sends a snapshot from the Job on connect, then subscribes to the emitter for live updates.

**Decision:** Option 3 (Hybrid). Real-time progress like Option 2 with no polling overhead, plus clean reconnect/late-connect handling from Option 1. The "two places" concern is cosmetic — both are updated in the same callback and cannot diverge.

### SSE Reconnection: Native EventSource vs No Recovery

**Options considered:**

1. **Native EventSource reconnect** — `EventSource` automatically retries on disconnect (~3s). Server sends current state on every connect, so reconnect and first connect share the same code path.
2. **No reconnect handling** — Connection drops, progress bar stalls, user must refresh.

**Decision:** Option 1. `EventSource` handles reconnect automatically, and the server already sends current state on connect (needed for page refresh support), so reconnect support is free.

### Page Refresh: Reconnectable Jobs vs No Recovery

**Options considered:**

1. **Reconnectable** — Client persists `jobId` (URL param or sessionStorage). Re-opening the SSE endpoint picks up current state or sends immediate `complete`/`error` if encoding finished.
2. **No recovery** — Page refresh loses all state. User re-uploads.

**Decision:** Option 1. Encoding runs server-side regardless of client state. The SSE endpoint already handles "connect to an in-progress job" — page refresh is the same code path. Only requires the client to persist a `jobId`.

### Partial Failure: Full Failure vs Partial Success

**Options considered:**

1. **Full failure** — If any encoding fails, job status is `error`, no downloads available.
2. **Partial success** — Job is `done` if at least one encoding succeeds. User can download what worked and sees a warning for what failed.

**Decision:** Option 2. No reason to discard a successful AV1 encode because H.264 failed (or vice versa). The client shows download buttons only for successful outputs and a warning for failed ones.

### Progress Parsing: `-progress pipe:1` vs stderr Parsing

**Options considered:**

1. **`-progress pipe:1`** — FFmpeg writes machine-readable key-value progress data to stdout. Parse `out_time_us` (microseconds), divide by total duration from ffprobe.
2. **stderr regex** — Parse `time=HH:MM:SS.ss` from FFmpeg's human-readable stderr output.

**Decision:** Option 1. The `-progress` flag is FFmpeg's intended mechanism for programmatic progress reporting. Structured, stable across versions, and doesn't compete with error output on stderr.

### Download Endpoint Shape: Per-Suffix vs Single Endpoint

**Options considered:**

1. **Per-suffix** — `GET /api/encode/:jobId/download/:suffix` (e.g., `/download/av1`). One URL per output.
2. **Single endpoint** — Returns JSON with both download URLs, client fetches each separately.

**Decision:** Option 1. Simpler, no extra round trip. Client renders a download button per successful output, each pointing to its suffix URL.

### Job Statuses: Three States

**Decision:** Simplified from four to three statuses: `encoding`, `done`, `error`. The `pending` status is dropped — `startEncoding` sets status to `encoding` immediately (before ffprobe), so the client never sees `pending`. A 0% progress communicates "just started" without needing a separate state.

---

## Technical Design

### Job Model Changes (`lib/jobs.ts`)

```ts
type EncodingOutput = {
  suffix: string; // "--av1.mp4" or "--h264.mp4"
  status: "pending" | "encoding" | "done" | "error";
  progress: number; // 0-100
  outputPath?: string; // set when done
  error?: string; // set on failure
};

type Job = {
  id: string;
  status: "encoding" | "done" | "error";
  inputPath: string;
  originalName: string; // original filename (no extension) for download naming
  presetId: string;
  createdAt: Date;
  duration?: number; // total duration in seconds from ffprobe
  outputs: EncodingOutput[];
  emitter: EventEmitter; // for live SSE progress
  error?: string;
};
```

Job-level `status` is derived from outputs:

- `"done"` if at least one output has status `"done"`
- `"error"` only if all outputs have status `"error"`

Individual outputs use `"pending"` internally (before their FFmpeg process starts) but this is not exposed to the client at the job level.

### FFmpeg Changes (`lib/ffmpeg.ts`)

**New: `probe()`**

```ts
function probe(inputPath: string): Promise<number>;
```

- Spawns `ffprobe -v quiet -print_format json -show_format <input>`
- Returns `format.duration` as a number (seconds)
- Rejects if ffprobe fails or duration is missing

**Updated: `encode()`**

```ts
function encode(
  inputPath: string,
  outputPath: string,
  args: string[],
  onProgress?: (percent: number) => void,
): Promise<void>;
```

- Adds `-progress pipe:1` to FFmpeg args
- Parses `out_time_us` from stdout lines, converts to seconds, divides by total duration
- Calls `onProgress` with calculated percentage
- stderr still captured for error reporting on failure

### Encoding Orchestrator (`lib/orchestrator.ts` — new file)

```ts
function startEncoding(job: Job, preset: Preset): void;
```

Returns `void` (fire-and-forget). The upload route calls this without awaiting.

**Flow:**

1. Set `job.status = "encoding"`
2. Run `probe(job.inputPath)` to get duration, store on `job.duration`
3. Initialize `job.outputs` from `preset.encodings` (one `EncodingOutput` per encoding config)
4. For each encoding, call `encode()` with an `onProgress` callback that:
   - Updates the corresponding output's `progress` and `status`
   - Emits a `progress` event on `job.emitter`
5. Run all encodes via `Promise.allSettled`
6. On each settle: set output to `"done"` (with `outputPath`) or `"error"` (with error message)
7. Set job-level status, emit `complete` event

If ffprobe fails, all outputs are set to `"error"`, job status is `"error"`, and `complete` is emitted.

### SSE Endpoint (`GET /api/encode/:jobId/progress`)

1. Look up job — if not found, return 404 (JSON, not SSE)
2. Set SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`)
3. Send immediate snapshot:
   - If `done` or `error` → send final event, close connection
   - If `encoding` → send current progress
4. Subscribe to `job.emitter`:
   - `progress` → send SSE with combined progress and per-output breakdown
   - `complete` → send final event, close connection
5. On client disconnect (`req.on("close")`) → remove listener from emitter

**SSE event format:**

```
data: {"status":"encoding","progress":47,"outputs":[{"suffix":"--av1.mp4","status":"encoding","progress":52},{"suffix":"--h264.mp4","status":"encoding","progress":42}]}

data: {"status":"done","outputs":[{"suffix":"--av1.mp4","status":"done"},{"suffix":"--h264.mp4","status":"error","error":"libsvtav1 not found"}]}
```

Combined `progress` is the average of all `outputs[].progress` values.

### Download Endpoint (`GET /api/encode/:jobId/download/:suffix`)

1. Look up job — if not found, return 404
2. Find output where suffix matches (e.g., `"av1"` matches `"--av1.mp4"`)
3. If output status is not `"done"` → 400
4. `res.download(output.outputPath, `${job.originalName}--${suffix}.mp4`)` — streams file with correct filename

### Upload Route Changes (`routes/encode.ts`)

- Accept `presetId` from form data, default to `"header-video"`
- Validate preset exists — 400 if not found
- Capture `originalName` from `req.file.originalname` (strip extension)
- Call `startEncoding(job, preset)` (no await)
- Response unchanged: `201` with `{ jobId }`

### Error Handling

| Failure                 | Where Caught         | Result                                                             |
| ----------------------- | -------------------- | ------------------------------------------------------------------ |
| ffprobe fails           | `startEncoding`      | All outputs `error`, job `error`, emits `complete`                 |
| One FFmpeg fails        | `Promise.allSettled` | That output `error`, other continues, job `done` if other succeeds |
| Both FFmpeg fail        | `Promise.allSettled` | Both outputs `error`, job `error`                                  |
| Client disconnects      | `req.on("close")`    | Listener removed, encoding continues                               |
| Download errored output | Download endpoint    | 400                                                                |
| Unknown suffix          | Download endpoint    | 404                                                                |
| Unknown jobId           | SSE or download      | 404                                                                |

---

## Acceptance Criteria

- [ ] Uploading a video triggers parallel AV1 and H.264 encoding without waiting for client SSE connection
- [ ] SSE endpoint streams combined progress as a percentage (0-100)
- [ ] SSE endpoint sends current state on connect (supports reconnect and page refresh)
- [ ] SSE endpoint sends a final event and closes when encoding completes or errors
- [ ] `GET /api/encode/:jobId/download/av1` returns the AV1 encoded file with correct filename
- [ ] `GET /api/encode/:jobId/download/h264` returns the H.264 encoded file with correct filename
- [ ] If one encoding fails and the other succeeds, job status is `done` and the successful file is downloadable
- [ ] If both encodings fail, job status is `error` with error details
- [ ] Upload accepts `presetId` in form data and validates it against known presets
- [ ] ffprobe extracts duration before encoding; ffprobe failure errors the entire job
- [ ] Client disconnect does not kill server-side encoding

---

## Files to Create/Modify

```
server/src/lib/orchestrator.ts   # new — encoding orchestration (ffprobe → parallel encode → job state)
server/src/lib/ffmpeg.ts         # modify — add probe(), add onProgress callback to encode()
server/src/lib/jobs.ts           # modify — expand Job type with outputs, emitter, originalName, duration
server/src/routes/encode.ts      # modify — accept presetId, capture originalName, fire startEncoding, add SSE + download endpoints
```
