# Video Encoder

Internal tool for encoding video assets into web-optimized formats. Drop a video file in the browser UI, watch encoding progress in real time, and download AV1 and H.264 outputs.

## Prerequisites

- Node.js v24+ (see `.nvmrc`)
- pnpm 10.28+
- FFmpeg installed and available on `PATH`

## Getting Started

```bash
pnpm install
pnpm dev
```

Opens the UI at `http://localhost:5173` (Vite dev server) with API requests proxied to Express on port 3000. In production, `pnpm build && pnpm start` serves everything from port 3000.

## Scripts

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Start Vite dev server + Express with tsx watch |
| `pnpm build`        | Build client and compile server                |
| `pnpm start`        | Run compiled server (serves UI + API)          |
| `pnpm lint`         | Run oxlint                                     |
| `pnpm format`       | Format with Prettier                           |
| `pnpm format:check` | Check formatting                               |

## API

### `GET /api/health`

Returns `200` with `{ status: "ok" }`.

### `POST /api/encode`

Upload a video file for encoding. Encoding starts immediately in the background.

- **Content-Type:** `multipart/form-data`
- **Field name:** `video`
- **Field (optional):** `presetId` — encoding preset to use (default: `"header-video"`)
- **Max file size:** 30 MB
- **Accepted types:** `video/*`

**Response (201):**

```json
{ "jobId": "uuid" }
```

Uploaded files are stored in `server/tmp/{jobId}/` and automatically cleaned up after 1 hour.

### `GET /api/encode/:jobId/progress`

Server-Sent Events endpoint for real-time encoding progress.

- Sends current state immediately on connect (supports reconnect/page refresh)
- Streams progress updates as `{ status, progress, outputs }` where `progress` is 0–100
- Sends a final event and closes the connection when encoding completes or errors
- Client disconnect does not cancel server-side encoding

### `GET /api/encode/:jobId/download/:suffix`

Download an encoded output file by codec suffix (`av1` or `h264`).

- Returns `404` if job or suffix not found
- Returns `400` if the requested output is not yet complete
- Filename format: `{originalName}--{suffix}.mp4`

## Encoding Presets

**Header Video** — optimized for web header/hero video:

| Output       | Codec     | Key Args                                        |
| ------------ | --------- | ----------------------------------------------- |
| `--av1.mp4`  | libsvtav1 | `-crf 35 -preset 4 -an -movflags +faststart`    |
| `--h264.mp4` | libx264   | `-crf 25 -preset slow -an -movflags +faststart` |

## Project Structure

```
├── client/
│   └── src/
│       ├── App.tsx               # Main UI with upload/progress/download flow
│       ├── components/
│       │   ├── DropZone.tsx      # Drag-and-drop file upload
│       │   ├── DownloadButtons.tsx # Output download links
│       │   └── ui/              # ShadCN components (Card, Button, Progress)
│       ├── hooks/
│       │   └── useEncodingProgress.ts # SSE hook for real-time progress
│       └── lib/
│           ├── api.ts           # Upload and download URL helpers
│           └── utils.ts         # ShadCN cn utility
├── server/
│   └── src/
│       ├── index.ts             # Express app entry point
│       ├── routes/
│       │   └── encode.ts        # Upload, SSE progress, and download endpoints
│       └── lib/
│           ├── jobs.ts          # In-memory job tracking
│           ├── presets.ts       # Encoding preset definitions
│           ├── ffmpeg.ts        # FFmpeg/ffprobe wrapper with progress
│           ├── orchestrator.ts  # Parallel encoding orchestration
│           └── cleanup.ts       # Temp file cleanup (1hr TTL)
├── lefthook.yml                 # Pre-commit hooks
└── tsconfig.base.json           # Shared TypeScript config
```
