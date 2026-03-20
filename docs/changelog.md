# Changelog

## 2026-03-20: Encoding Pipeline

Parallel AV1 + H.264 encoding with real-time SSE progress streaming and file download endpoints. Upload triggers encoding automatically, SSE streams combined progress as a percentage, and output files are downloadable by codec suffix.

**Design:** docs/design-specs/2026-03-20-1146-encoding-pipeline.md
**Plan:** docs/implementation-plans/2026-03-20-1220-encoding-pipeline.md
**Key files:** server/src/lib/jobs.ts, server/src/lib/ffmpeg.ts, server/src/lib/orchestrator.ts, server/src/routes/encode.ts, server/src/lib/presets.ts

## 2026-03-19: Server Foundation

Express 5 / TypeScript server in a pnpm monorepo with video upload, FFmpeg integration, encoding presets, and temp file cleanup. Shared tooling (Prettier, oxlint, Lefthook) included.

**Design:** docs/design-specs/2026-03-19-1716-server-foundation.md
**Plan:** docs/implementation-plans/2026-03-19-2113-server-foundation.md
**Key files:** server/src/index.ts, server/src/routes/encode.ts, server/src/lib/jobs.ts, server/src/lib/presets.ts, server/src/lib/ffmpeg.ts, server/src/lib/cleanup.ts, lefthook.yml
