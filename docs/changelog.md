# Changelog

## 2026-03-19: Server Foundation

Express 5 / TypeScript server in a pnpm monorepo with video upload, FFmpeg integration, encoding presets, and temp file cleanup. Shared tooling (Prettier, oxlint, Lefthook) included.

**Design:** docs/design-specs/2026-03-19-1716-server-foundation.md
**Plan:** docs/implementation-plans/2026-03-19-2113-server-foundation.md
**Key files:** server/src/index.ts, server/src/routes/encode.ts, server/src/lib/jobs.ts, server/src/lib/presets.ts, server/src/lib/ffmpeg.ts, server/src/lib/cleanup.ts, lefthook.yml
