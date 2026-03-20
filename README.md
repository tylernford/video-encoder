# Video Encoder

Internal tool for encoding video assets into web-optimized formats. Accepts a video upload, encodes it into multiple formats (AV1 and H.264), and serves the outputs for download.

## Prerequisites

- Node.js v24+ (see `.nvmrc`)
- pnpm 10.28+
- FFmpeg installed and available on `PATH`

## Getting Started

```bash
pnpm install
pnpm dev
```

The server starts on `http://localhost:3000` (override with `PORT` env var).

## Scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `pnpm dev`          | Start server with tsx watch          |
| `pnpm build`        | Compile TypeScript to `server/dist/` |
| `pnpm start`        | Run compiled server                  |
| `pnpm lint`         | Run oxlint                           |
| `pnpm format`       | Format with Prettier                 |
| `pnpm format:check` | Check formatting                     |

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
├── server/
│   └── src/
│       ├── index.ts          # Express app entry point
│       ├── routes/
│       │   └── encode.ts     # Upload, SSE progress, and download endpoints
│       └── lib/
│           ├── jobs.ts       # In-memory job tracking
│           ├── presets.ts    # Encoding preset definitions
│           ├── ffmpeg.ts     # FFmpeg/ffprobe wrapper with progress
│           ├── orchestrator.ts # Parallel encoding orchestration
│           └── cleanup.ts   # Temp file cleanup (1hr TTL)
├── lefthook.yml              # Pre-commit hooks
└── tsconfig.base.json        # Shared TypeScript config
```
