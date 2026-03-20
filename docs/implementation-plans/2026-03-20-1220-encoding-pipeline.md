# Implementation Plan: Encoding Pipeline

**Created:** 2026-03-20 **Type:** Feature **Overview:** Parallel FFmpeg encoding with real-time progress streaming via SSE and file download endpoints, building on the Phase 1 server foundation. **Design Spec:** docs/design-specs/2026-03-20-1146-encoding-pipeline.md

---

## Summary

Wire the Phase 1 server foundation (upload, job tracking, FFmpeg wrapper, presets) into a working encoding pipeline. An uploaded video is encoded into AV1 + H.264 in parallel, progress is streamed to the client via SSE in real time, and output files can be downloaded.

---

## Codebase Verification

_Confirm assumptions from design spec match actual codebase_

- [x] `jobs.ts` has Job type with `id`, `status`, `inputPath`, `presetId`, `createdAt`, `error` — Verified: yes, matches expected base
- [x] `ffmpeg.ts` has `encode(inputPath, outputPath, args)` — Verified: yes, signature matches
- [x] `presets.ts` defines `EncodingConfig` with `codec`, `args`, `suffix` and a `"header-video"` preset — Verified: yes
- [x] Upload route creates job and writes file to `tmp/{jobId}/original.mp4` — Verified: yes
- [x] No encoding is triggered yet — upload only creates the job record — Verified: yes

**Patterns to leverage:**

- Existing `encode()` spawn/stderr pattern in `ffmpeg.ts`
- Existing `createJob()`/`getJob()` in `jobs.ts`
- Existing `getPreset()` in `presets.ts`
- Multer memory storage + file validation in `routes/encode.ts`

**Discrepancies found:**

- Current `JobStatus` includes `"pending"` — design spec drops it to 3 states (`encoding`, `done`, `error`). No code depends on `"pending"` meaningfully, so this is a clean removal.

---

## Tasks

### Task 1: Expand Job model

**Description:** Update the Job type to include `outputs`, `emitter`, `originalName`, `duration`, and the `EncodingOutput` type. Remove `"pending"` from `JobStatus`. Update `createJob` to accept `originalName` and initialize `emitter`.

**Files:**

- `server/src/lib/jobs.ts` - modify

**Done when:** Edited files pass `tsc --noEmit` (file-scoped) and `oxlint` (file-scoped).

**Commit:** "feat(jobs): expand Job model with outputs, emitter, and originalName"

---

### Task 2: Add `probe()` and `onProgress` to ffmpeg

**Description:** Add `probe()` function that spawns `ffprobe -v quiet -print_format json -show_format <input>` and returns `format.duration` as a number (seconds). Update `encode()` to accept a `duration` parameter and optional `onProgress` callback, add `-progress pipe:1` to FFmpeg args, parse `out_time_us` from stdout lines, convert to seconds, divide by duration, and call `onProgress` with the calculated percentage. stderr is still captured for error reporting.

**Files:**

- `server/src/lib/ffmpeg.ts` - modify

**Done when:** Edited files pass `tsc --noEmit` (file-scoped) and `oxlint` (file-scoped).

**Commit:** "feat(ffmpeg): add probe() and onProgress support to encode()"

---

### Task 3: Create encoding orchestrator

**Description:** Create `startEncoding(job, preset)` that:

1. Sets `job.status = "encoding"`
2. Runs `probe(job.inputPath)` to get duration, stores on `job.duration`
3. Initializes `job.outputs` from `preset.encodings` (one `EncodingOutput` per encoding config)
4. For each encoding, calls `encode()` with an `onProgress` callback that updates the output's `progress`/`status` and emits a `progress` event on `job.emitter`
5. Runs all encodes via `Promise.allSettled`
6. On each settle: sets output to `"done"` (with `outputPath`) or `"error"` (with error message)
7. Derives job-level status (`"done"` if at least one output succeeded, `"error"` if all failed), emits `complete` event

If ffprobe fails: all outputs set to `"error"`, job status `"error"`, `complete` emitted.

**Files:**

- `server/src/lib/orchestrator.ts` - create

**Done when:** Edited files pass `tsc --noEmit` (file-scoped) and `oxlint` (file-scoped).

**Commit:** "feat: add encoding orchestrator with parallel encode and progress events"

---

### Task 4: Add SSE and download endpoints, update upload route

**Description:**

- Update upload route to accept `presetId` from form data (default `"header-video"`), validate preset exists (400 if not), capture `originalName` from `req.file.originalname` (strip extension), pass to `createJob`, call `startEncoding(job, preset)` (no await)
- Add `GET /api/encode/:jobId/progress` SSE endpoint:
  - Look up job (404 if not found)
  - Set SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`)
  - Send immediate snapshot (if `done`/`error` → final event + close; if `encoding` → current progress)
  - Subscribe to `job.emitter` for `progress` and `complete` events
  - On client disconnect → remove listener
  - SSE data format: `{"status","progress","outputs":[...]}`
- Add `GET /api/encode/:jobId/download/:suffix` endpoint:
  - Look up job (404 if not found)
  - Find output matching suffix (404 if not found)
  - If output status is not `"done"` → 400
  - `res.download(outputPath, `${job.originalName}--${suffix}.mp4`)`

**Files:**

- `server/src/routes/encode.ts` - modify

**Done when:** Edited files pass `tsc --noEmit` (file-scoped) and `oxlint` (file-scoped).

**Commit:** "feat(routes): add SSE progress and download endpoints, accept presetId"

---

### Task 5: Manual integration test

**Description:** Build the project, start the server, and test the full flow with curl/httpie: upload a video with `POST /api/encode`, connect to SSE at `GET /api/encode/:jobId/progress`, observe progress events, download files at `GET /api/encode/:jobId/download/av1` and `/download/h264`.

**Files:** None (verification only)

**Done when:** Full upload → encode → progress → download flow works end-to-end. Server compiles and runs cleanly.

**Commit:** No commit (verification task)

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

## Build Log

_Filled in during `/build` phase_

| Date | Task | Files | Notes |
| ---- | ---- | ----- | ----- |
| 2026-03-20 | Task 1 | server/src/lib/jobs.ts | Done as planned. Cross-file type error in encode.ts expected until Task 4. |

---

## Completion

**Completed:** [Date] **Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- Each task must pass file-scoped typecheck and lint on edited files. Pre-commit hooks may fail on cross-file issues — force the commit if needed.
- EventEmitter is from Node.js built-in `node:events` — no additional dependencies needed.
- The `"pending"` status is removed from job-level `JobStatus` but retained in `EncodingOutput.status` for individual outputs that haven't started encoding yet.
