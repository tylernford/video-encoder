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

Upload a video file for encoding.

- **Content-Type:** `multipart/form-data`
- **Field name:** `video`
- **Max file size:** 30 MB
- **Accepted types:** `video/*`

**Response (201):**

```json
{ "jobId": "uuid" }
```

Uploaded files are stored in `server/tmp/{jobId}/` and automatically cleaned up after 1 hour.

## Encoding Presets

**Header Video** — optimized for web header/hero video:

| Output       | Codec     | Key Args                                        |
| ------------ | --------- | ----------------------------------------------- |
| `--av1.mp4`  | libsvtav1 | `-crf 35 -preset 6 -an -movflags +faststart`    |
| `--h264.mp4` | libx264   | `-crf 23 -preset slow -an -movflags +faststart` |

## Project Structure

```
├── server/
│   └── src/
│       ├── index.ts          # Express app entry point
│       ├── routes/
│       │   └── encode.ts     # Upload endpoint
│       └── lib/
│           ├── jobs.ts       # In-memory job tracking
│           ├── presets.ts    # Encoding preset definitions
│           ├── ffmpeg.ts     # FFmpeg spawn wrapper
│           └── cleanup.ts   # Temp file cleanup (1hr TTL)
├── lefthook.yml              # Pre-commit hooks
└── tsconfig.base.json        # Shared TypeScript config
```
