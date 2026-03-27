# Implementation Plan: Integration & Deployment

**Created:** 2026-03-27 **Type:** Enhancement **Overview:** Production-ready deployment of the video encoder app to a DigitalOcean droplet managed by Laravel Forge, including FFmpeg installation, process management, and a configurable encoding strategy. **Design Spec:** docs/design-specs/2026-03-27-0930-integration-deployment.md

---

## Summary

Most deployment requirements (build scripts, static file serving, PORT env var, temp file cleanup) are already implemented. This plan covers the two remaining code changes: configurable parallel/sequential encoding and a PM2 ecosystem config file.

---

## Codebase Verification

_Confirm assumptions from design spec match actual codebase_

- [x] Express serves static `client/dist` files - Verified: yes, `server/src/index.ts` has `express.static` pointing to `../../client/dist`
- [x] `pnpm build` produces client + server artifacts - Verified: yes, root `package.json` runs client then server build
- [x] `pnpm start` runs production server - Verified: yes, runs `node dist/index.js` via server package
- [x] PORT reads from env - Verified: yes, `process.env.PORT ?? 3000`
- [x] Encoding uses `Promise.allSettled` for parallel encoding - Verified: yes, in `server/src/lib/orchestrator.ts`
- [x] Temp file cleanup exists - Verified: yes, `server/src/lib/cleanup.ts` sweeps every 10 min, 1-hour TTL

**Patterns to leverage:**

- Existing `Promise.allSettled` block in orchestrator can be wrapped in a conditional
- Error handling per-encoding already works (checks `result.status === "rejected"`)

**Discrepancies found:**

- None. Codebase is ahead of what the design spec's "Suggested Files" section assumed.

---

## Tasks

### Task 1: Add configurable parallel/sequential encoding

**Description:** Read `ENCODE_PARALLEL` env var (default `"false"`) and branch the encoding logic. When `false`, run encodings sequentially in a `for` loop. When `true`, keep the existing `Promise.allSettled` behavior. Both paths must handle per-encoding errors without blocking the other encoding.

**Files:**

- `server/src/lib/orchestrator.ts` - modify

**Code example:**

```ts
const parallel = process.env.ENCODE_PARALLEL === "true";

if (parallel) {
  // existing Promise.allSettled block
} else {
  for (let i = 0; i < preset.encodings.length; i++) {
    const enc = preset.encodings[i];
    const output = job.outputs[i];
    const outputPath = path.join(jobDir, `${job.originalName}${enc.suffix}`);
    output.status = "encoding";
    try {
      await encode(/* ... */);
      output.status = "done";
      output.progress = 100;
      output.outputPath = outputPath;
    } catch (err) {
      output.status = "error";
      output.error = err instanceof Error ? err.message : String(err);
    }
  }
}
```

**Done when:** With `ENCODE_PARALLEL` unset or `"false"`, encodings run one at a time. With `"true"`, they run in parallel. Errors on one don't block the other. **Commit:** "feat: add configurable parallel/sequential encoding via ENCODE_PARALLEL"

---

### Task 2: Add PM2 ecosystem config

**Description:** Create `ecosystem.config.cjs` at project root with app name, start command, and default environment variables.

**Files:**

- `ecosystem.config.cjs` - create

**Code example:**

```js
module.exports = {
  apps: [
    {
      name: "video-encoder",
      script: "pnpm",
      args: "start",
      env: {
        PORT: 3000,
        ENCODE_PARALLEL: "false",
      },
    },
  ],
};
```

**Done when:** File exists and `pm2 start ecosystem.config.cjs` would launch the app correctly. **Commit:** "feat: add PM2 ecosystem config"

---

## Acceptance Criteria

- [ ] `pnpm build && pnpm start` serves the full app (client + API) on a single port
- [ ] With `ENCODE_PARALLEL=false` (or unset), encodings run sequentially
- [ ] With `ENCODE_PARALLEL=true`, encodings run in parallel
- [ ] Errors on one encoding don't prevent the other from completing
- [ ] `ecosystem.config.cjs` defines the app with correct name, script, and env defaults

---

## Build Log

_Filled in during `/build` phase_

| Date       | Task   | Files                          | Notes                                 |
| ---------- | ------ | ------------------------------ | ------------------------------------- |
| 2026-03-27 | Task 1 | server/src/lib/orchestrator.ts | Implemented as planned. Build passes. |
| 2026-03-27 | Task 2 | ecosystem.config.cjs           | Created as planned.                   |

---

## Completion

**Completed:** [Date] **Final Status:** [Complete | Partial | Abandoned]

**Summary:** [Brief description of what was actually built]

**Deviations from Plan:** [Any significant changes from original design]

---

## Notes

- Most deployment requirements were already implemented in prior phases. This plan only covers the two remaining code changes.
- Server provisioning (FFmpeg install, PM2 setup, nginx config) is manual and documented in the design spec's Server Setup Guide — not part of this implementation plan.
