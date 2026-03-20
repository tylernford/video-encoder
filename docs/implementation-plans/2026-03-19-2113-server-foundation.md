# Implementation Plan: Server Foundation

**Created:** 2026-03-19 **Type:** Feature **Overview:** Express server scaffolding with TypeScript, FFmpeg integration, upload endpoint, preset config, and temp file cleanup. **Design Spec:** docs/design-specs/2026-03-19-1716-server-foundation.md

---

## Summary

Set up a pnpm monorepo with an Express/TypeScript server package. Includes shared tooling (Prettier, oxlint, Lefthook), a video upload endpoint with multer validation, in-memory job tracking, an FFmpeg spawn wrapper, encoding presets, and timer-based temp file cleanup. This is the foundation all subsequent phases build on.

---

## Codebase Verification

- [x] Greenfield repo — no existing code, configs, or dependencies to conflict with
- [x] No existing package.json, tsconfig, or server directory
- [x] Design spec assumptions are all valid against current state

**Patterns to leverage:**

- None — first code in the repo

**Discrepancies found:**

- None

---

## Tasks

> **Workflow:** For tasks that introduce new dependencies, install the dependency via `pnpm add` first, then write the config/source files. This lets the install generate package.json entries and lockfile changes naturally.

### Task 1: Root workspace scaffolding

**Description:** Set up the pnpm monorepo root with workspace config, TypeScript base config, Prettier, and .gitignore.

**Files:**

- `package.json` — create (root workspace config, shared tooling scripts)
- `pnpm-workspace.yaml` — create (declares server/ workspace)
- `tsconfig.base.json` — create (strict mode, ESM with module: NodeNext)
- `.prettierrc` — create
- `.gitignore` — create (node_modules, dist, server/tmp)

**Done when:** `pnpm install` succeeds from root with no errors.

**Commit:** `Add root workspace scaffolding`

---

### Task 2: Linting and git hooks

**Description:** Add oxlint and Lefthook pre-commit hook that runs Prettier check + oxlint.

**Files:**

- `lefthook.yml` — create (pre-commit: prettier --check + oxlint)
- `package.json` — modify (add oxlint + lefthook devDeps, lint/format scripts)

**Done when:** `lefthook run pre-commit` passes on a clean repo. Introducing a formatting violation or lint error causes it to fail.

**Commit:** `Add oxlint and Lefthook pre-commit hook`

---

### Task 3: Server package and Express entry point

**Description:** Create the server workspace package with TypeScript config, Express app setup, and dev/build scripts.

**Files:**

- `server/package.json` — create (express, tsx, typescript deps + dev/build/start scripts)
- `server/tsconfig.json` — create (extends root base, outDir: dist)
- `server/src/index.ts` — create (Express app, listen on PORT env var defaulting to 3000, GET /api/health endpoint)

**Done when:** `pnpm dev` starts the server with tsx watch. `pnpm build` compiles to `server/dist/`. `GET /api/health` returns 200.

**Commit:** `Add Express server with dev and build scripts`

---

### Task 4: Job tracking and preset config

**Description:** Add the in-memory job store and the "Header Video" preset definition with AV1 + H.264 encoding configs.

**Files:**

- `server/src/lib/jobs.ts` — create (Job type, Map store, create/get helpers)
- `server/src/lib/presets.ts` — create (Preset/EncodingConfig types, Header Video preset data)

**Code example:**

```ts
type EncodingConfig = {
  codec: string
  args: string[]
  suffix: string
}

type Preset = {
  id: string
  label: string
  encodings: EncodingConfig[]
}
```

Header Video preset encodings:

| Output suffix | Codec | Key Args |
|---|---|---|
| `--av1.mp4` | libsvtav1 | `-crf 35 -preset 6 -an -movflags +faststart` |
| `--h264.mp4` | libx264 | `-crf 23 -preset slow -an -movflags +faststart` |

**Done when:** Types are correct, preset data matches the spec values above.

**Commit:** `Add job tracking and encoding presets`

---

### Task 5: Upload endpoint

**Description:** Add the `POST /api/encode` route with multer middleware for file upload, video MIME type validation, 30MB size limit, job creation, and file storage in `server/tmp/{jobId}/`.

**Files:**

- `server/src/routes/encode.ts` — create (multer config with fileFilter + limits, route handler)
- `server/src/index.ts` — modify (register encode route)

**Done when:**

- `POST /api/encode` with a valid video file returns 201 + `{ jobId }`
- `POST /api/encode` with a >30MB file returns 400
- `POST /api/encode` with a non-video file returns 400
- Uploaded file is stored at `server/tmp/{jobId}/original.mp4`

**Commit:** `Add upload endpoint with multer validation`

---

### Task 6: FFmpeg spawn wrapper

**Description:** Create the FFmpeg wrapper that spawns ffmpeg as a child process, resolves on exit code 0, and rejects with captured stderr on failure.

**Files:**

- `server/src/lib/ffmpeg.ts` — create

**Code example:**

```ts
function encode(inputPath: string, outputPath: string, args: string[]): Promise<void>
```

- Spawns `ffmpeg` with args passed directly to `child_process.spawn()` (no shell)
- Resolves on exit code 0
- Rejects with stderr output on non-zero exit
- No progress parsing (added in Phase 2)

**Done when:** Calling `encode()` with valid input/output/args spawns ffmpeg, resolves on success, rejects with stderr on failure.

**Commit:** `Add FFmpeg spawn wrapper`

---

### Task 7: Temp file cleanup

**Description:** Add the setInterval-based cleanup that scans `server/tmp/` and purges job directories where all files have mtime older than 1 hour. Runs every 10 minutes. Creates `server/tmp/` if it doesn't exist.

**Files:**

- `server/src/lib/cleanup.ts` — create (startCleanup function)
- `server/src/index.ts` — modify (call startCleanup on server boot)

**Done when:** Cleanup runs on a 10-minute interval, deletes directories where all files have mtime > 1 hour, creates `server/tmp/` if missing.

**Commit:** `Add temp file cleanup`

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

## Build Log

_Filled in during `/build` phase_

| Date | Task | Files | Notes |
| ---- | ---- | ----- | ----- |
| 2026-03-19 | Task 1 | package.json, pnpm-workspace.yaml, tsconfig.base.json, .prettierrc, .gitignore, .nvmrc | Deviated: Prettier config adjusted to user preference (semi: true, singleQuote: false). Added packageManager field (pnpm@10.28.0) and .nvmrc (v24) — not in original plan. |

---

## Completion

**Completed:** [Date] **Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- This is Phase 1 of 4. Phase 2 (encoding pipeline) and Phase 3 (frontend) depend on this foundation.
- Job tracking is intentionally in-memory — acceptable for 3 users, one video at a time.
- FFmpeg progress parsing is explicitly out of scope (Phase 2).
