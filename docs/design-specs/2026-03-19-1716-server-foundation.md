# Server Foundation

**Created:** 2026-03-19 **Implementation Plan:** docs/implementation-plans/2026-03-19-2113-server-foundation.md

**Parent Spec:** [Video Encoder App](./2026-03-19-1623-video-encoder-app.md) (Phase 1)

---

## Overview

**What:** Express server scaffolding with TypeScript, FFmpeg integration, upload endpoint, preset config, and temp file cleanup.

**Why:** This is the foundation that all subsequent phases build on. Phase 2 (encoding pipeline) and Phase 3 (frontend) both depend on a working server with file handling, FFmpeg access, and job tracking.

**Type:** Feature

---

## Requirements

### Must Have

- [ ] pnpm monorepo with workspace config (root + `server/`)
- [ ] Shared tooling at root: Prettier, oxlint, Lefthook (pre-commit runs formatting check + linting)
- [ ] TypeScript: strict mode, ESM, shared base config at root
- [ ] Express server with `tsx watch` for dev and `tsc` for production build
- [ ] Upload endpoint (`POST /api/encode`) with multer: 30MB limit, video MIME type validation
- [ ] In-memory job tracking via `Map<string, Job>`
- [ ] Uploaded files stored in `server/tmp/{jobId}/`
- [ ] FFmpeg spawn wrapper (basic execute and resolve/reject, no progress parsing)
- [ ] Preset config with fully populated "Header Video" preset (AV1 + H.264)
- [ ] Temp file cleanup via `setInterval` (purge files older than 1 hour, runs every 10 minutes)
- [ ] `PORT` env var with default of 3000

### Nice to Have

- [ ] Health check endpoint (`GET /api/health`)

### Out of Scope

- Parallel encoding orchestration (Phase 2)
- SSE progress streaming (Phase 2)
- FFmpeg stderr progress parsing (Phase 2)
- Download endpoints (Phase 2)
- Client/frontend (Phase 3)
- Deployment config (Phase 4)

---

## Design Decisions

### Project Structure: Flat vs src Directory vs Monorepo

**Options considered:**

1. **Flat server directory** — All files directly in `server/`. Matches the root spec layout. Simple but mixes source and config.
2. **src directory** — Source in `server/src/`, config at `server/` root. Clean separation, `tsc` outputs to `dist/`.
3. **Monorepo with pnpm workspaces** — Root holds shared tooling, `server/` is a workspace package with its own deps. Ready for `client/` in Phase 3.

**Decision:** Option 3 (monorepo). Avoids a restructuring when the client arrives in Phase 3. Shared tooling (Prettier, oxlint, Lefthook) lives at the root. Runtime deps are scoped to `server/package.json`.

### Job Tracking: In-Memory Map vs SQLite vs Filesystem

**Options considered:**

1. **In-memory Map** — Simple `Map<string, Job>`. Lost on restart. Easy to extend.
2. **SQLite** — Persistent. Survives restarts. Overkill for three users.
3. **Filesystem-based** — Derive state from files in `tmp/`. Brittle, hard to distinguish upload states.

**Decision:** Option 1 (in-memory Map). Three users, one video at a time, internal tool. A Map is the right complexity. Phase 2 extends it with progress/status fields.

### TypeScript Configuration

**Decision:** Strict mode, ESM (`"module": "NodeNext"`). Shared `tsconfig.base.json` at root so the client can extend it in Phase 3. Server's `tsconfig.json` extends base with `outDir: "dist"`.

### FFmpeg Args Format

**Decision:** Args stored as `string[]` (not a single string). Passed directly to `child_process.spawn()`, avoiding shell escaping issues.

---

## Technical Design

### Project Layout

```
video-encoder/
  package.json              # root workspace config, shared tooling scripts
  pnpm-workspace.yaml       # declares server/ (and later client/)
  tsconfig.base.json        # shared strict + ESM TypeScript config
  .prettierrc               # Prettier config
  lefthook.yml              # pre-commit: prettier --check + oxlint
  .gitignore                # node_modules, dist, server/tmp
  server/
    package.json            # server deps (express, multer, tsx, typescript)
    tsconfig.json           # extends root base, sets outDir: dist
    src/
      index.ts              # Express app setup, starts server
      routes/encode.ts      # POST /api/encode — upload endpoint
      lib/ffmpeg.ts         # FFmpeg spawn wrapper
      lib/presets.ts        # Preset type definitions and data
      lib/cleanup.ts        # setInterval-based temp file purge
      lib/jobs.ts           # Job type and in-memory Map
    tmp/                    # gitignored, created at runtime
```

### Upload Endpoint (`POST /api/encode`)

- multer middleware: single file upload, 30MB limit, video MIME type filter
- Generates UUID job ID
- Stores file in `server/tmp/{jobId}/original.mp4`
- Creates job entry in Map with status `"uploaded"`
- Returns `{ jobId }` with 201 status
- Returns 400 with error message on validation failure

### FFmpeg Spawn Wrapper (`lib/ffmpeg.ts`)

```ts
function encode(
  inputPath: string,
  outputPath: string,
  args: string[],
): Promise<void>;
```

- Spawns `ffmpeg` as a child process
- Resolves on exit code 0, rejects on non-zero
- Captures stderr for error reporting on failure
- No progress parsing — added in Phase 2

### Preset Config (`lib/presets.ts`)

```ts
type EncodingConfig = {
  codec: string;
  args: string[];
  suffix: string;
};

type Preset = {
  id: string;
  label: string;
  encodings: EncodingConfig[];
};
```

Ships with one preset:

| Preset       | Output       | Codec     | Key Args                                        |
| ------------ | ------------ | --------- | ----------------------------------------------- |
| Header Video | `--av1.mp4`  | libsvtav1 | `-crf 35 -preset 6 -an -movflags +faststart`    |
| Header Video | `--h264.mp4` | libx264   | `-crf 23 -preset slow -an -movflags +faststart` |

### Job Tracking (`lib/jobs.ts`)

```ts
type Job = {
  id: string;
  status: "uploaded" | "encoding" | "complete" | "error";
  originalName: string;
  presetId: string;
  createdAt: Date;
};

const jobs: Map<string, Job>;
```

### Temp File Cleanup (`lib/cleanup.ts`)

- `setInterval` runs every 10 minutes
- Scans `server/tmp/` for job directories
- Deletes any directory where all files are older than 1 hour (mtime)
- Creates `server/tmp/` if it doesn't exist

---

## Acceptance Criteria

- [ ] `pnpm install` succeeds from root
- [ ] `pnpm dev` starts the Express server with tsx watch
- [ ] `pnpm build` compiles TypeScript to `server/dist/`
- [ ] Lefthook pre-commit runs Prettier check + oxlint
- [ ] `POST /api/encode` with a valid video file returns `{ jobId }` with 201
- [ ] `POST /api/encode` with a >30MB file returns 400
- [ ] `POST /api/encode` with a non-video file returns 400
- [ ] Uploaded file is stored in `server/tmp/{jobId}/`
- [ ] Temp files older than 1 hour are cleaned up automatically
- [ ] FFmpeg spawn wrapper can execute a basic encode and resolve/reject

---

## Files to Create

```
package.json                # root workspace config, shared tooling
pnpm-workspace.yaml         # workspace declaration
tsconfig.base.json          # shared TypeScript base config
.prettierrc                 # Prettier config
lefthook.yml                # pre-commit hook config
.gitignore                  # ignore patterns
server/package.json         # server dependencies
server/tsconfig.json        # server TypeScript config (extends base)
server/src/index.ts         # Express app entry point
server/src/routes/encode.ts # Upload endpoint
server/src/lib/ffmpeg.ts    # FFmpeg spawn wrapper
server/src/lib/presets.ts   # Preset definitions
server/src/lib/cleanup.ts   # Temp file cleanup
server/src/lib/jobs.ts      # Job type and in-memory store
```
