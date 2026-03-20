# Video Encoder App

**Created:** 2026-03-19 **Implementation Plan:** TBD

---

## Overview

**What:** A web app that allows designers to upload a video, encode it with preset FFmpeg parameters, and download optimized output files.

**Why:** The studio's case study pages serve ~30MB header/inline videos via Vimeo, resulting in terrible page load performance. Custom FFmpeg encoding reduces files to ~3.5MB, but running CLI commands is not viable for the design team. This app makes the encoding self-service.

**Type:** Feature

---

## Requirements

### Must Have

- [ ] Dropdown to select an encoding preset (ships with "Header Video" only)
- [ ] Single video file upload with drag-and-drop support (max 30MB, validated client and server side)
- [ ] Two parallel FFmpeg encodings per upload: AV1 (primary) and H.264 (Safari fallback)
- [ ] Combined determinate progress bar showing encoding progress via Server-Sent Events
- [ ] Two download buttons on completion with files named `{original}--av1.mp4` and `{original}--h264.mp4`
- [ ] Automatic temp file cleanup (delete files older than 1 hour)
- [ ] Deployable to a DigitalOcean droplet

### Nice to Have

- [ ] Batch uploads (process multiple videos in a queue)
- [ ] Additional encoding presets (e.g., "Inline Video")

### Out of Scope

- Authentication
- Audio support (all videos are silent)
- Direct CMS integration (designers download and upload to CMS manually)

---

## Design Decisions

### Architecture: Monolith vs Separate Frontend vs Client-Side Encoding

**Options considered:**

1. **Node.js + Express monolith** — Single server handles UI, uploads, and encoding. Simple to build, deploy, and maintain.
2. **Separate frontend + API** — Frontend deployed separately from API server. Cleaner separation but more deployment overhead for no benefit at this scale.
3. **Client-side encoding (FFmpeg.wasm)** — Run encoding in the browser. No server processing needed, but libsvtav1 is not available in FFmpeg.wasm, making this a non-starter.

**Decision:** Option 1 (monolith). Three users, internal tool, single video at a time — a monolith is the right level of complexity. Can be split into separate frontend + API later if needed.

### Video Codec Strategy: AV1 Only vs AV1 + Fallback

**Options considered:**

1. **AV1 only** — Smallest file sizes, but Safari only supports AV1 on M3+ Macs and iPhone 15 Pro+.
2. **AV1 + WebM/VP9 fallback** — VP9 has broad support, but Safari 18 dropped VP9 decode support entirely.
3. **AV1 + H.264 fallback** — H.264 has universal browser support. Slightly larger files than AV1 but works everywhere.

**Decision:** Option 3 (AV1 + H.264). Each upload produces two files. The studio site uses `<source>` tags so browsers pick AV1 when supported, H.264 otherwise.

### Encoding Presets

Presets are defined as data in a config file, making it trivial to add new ones. Each preset specifies a label and an array of encoding configurations (codec, args, output suffix).

**Header Video preset (v1):**

| Output       | Codec     | Key Args                                        |
| ------------ | --------- | ----------------------------------------------- |
| `--av1.mp4`  | libsvtav1 | `-crf 35 -preset 6 -an -movflags +faststart`    |
| `--h264.mp4` | libx264   | `-crf 23 -preset slow -an -movflags +faststart` |

### Progress Reporting

**Options considered:**

1. **Determinate progress bar** — Parse FFmpeg stderr for frame progress, push updates via SSE, show percentage.
2. **Indeterminate spinner** — Simple "Processing..." state until done.

**Decision:** Option 1 (determinate). Since encoding may take several minutes, a real progress bar gives designers confidence the process is working. Both encodings run in parallel; progress is displayed as a single combined bar (average of both).

### File Cleanup

**Decision:** Timer-based cleanup. A `setInterval` purges any temp files older than 1 hour. This handles cases where designers close the tab before downloading.

---

## Acceptance Criteria

- [ ] Designer can select an encoding preset from a dropdown
- [ ] Designer can upload a video file (max 30MB, validated client and server side)
- [ ] Both AV1 and H.264 encodings run in parallel on the server
- [ ] A combined progress bar shows encoding progress via SSE
- [ ] On completion, two download buttons appear with correctly named files (`name--av1.mp4`, `name--h264.mp4`)
- [ ] Downloaded files play correctly in a browser
- [ ] Temp files are cleaned up automatically after 1 hour
- [ ] App is deployable to a DigitalOcean droplet
- [ ] FFmpeg with libsvtav1 and libx264 is available on the server

---

## Tech Stack

- **Runtime:** Node.js
- **Server:** Express
- **Frontend:** React + Vite + ShadCN
- **Progress:** Server-Sent Events (SSE)
- **FFmpeg:** Spawned via Node.js `child_process`
- **File handling:** `multer` for uploads
- **Cleanup:** `setInterval`-based temp file purge

---

## Implementation Phases

### Phase 1: Server Foundation

- Express server setup, project scaffolding (TypeScript, dev scripts)
- FFmpeg integration (spawning processes, parsing stderr for progress)
- Preset config structure (`server/lib/presets.ts`)
- Upload endpoint with multer (file validation, size limit)
- Temp file cleanup (`setInterval`-based)

### Phase 2: Encoding Pipeline

- AV1 + H.264 parallel encoding via `Promise.all`
- SSE progress streaming endpoint
- Download endpoints for encoded files
- Error handling (FFmpeg failures, invalid files, oversized uploads)

### Phase 3: Frontend

- React + Vite + ShadCN project setup
- Upload form with drag-and-drop
- Preset dropdown (populated from server)
- Combined progress bar (SSE client)
- Download buttons for both output files

### Phase 4: Integration & Deployment

- Express serves client build in production
- End-to-end testing on target DigitalOcean droplet size
- Validate AV1 encoding performance on droplet CPU
- Deployment setup (PM2, systemd, or similar)
- Domain/subdomain configuration

---

## Suggested Files to Create/Modify

```
client/src/App.tsx              # Main app layout
client/src/components/          # Upload form, preset dropdown, progress bar, download buttons
server/index.ts                 # Express server, serves client build in prod
server/routes/encode.ts         # Upload + encoding endpoint, SSE progress stream
server/lib/ffmpeg.ts            # FFmpeg process spawning & progress parsing
server/lib/presets.ts           # Encoding preset definitions
server/lib/cleanup.ts           # Temp file cleanup logic
server/tmp/                     # Temp upload & output storage (gitignored)
```
