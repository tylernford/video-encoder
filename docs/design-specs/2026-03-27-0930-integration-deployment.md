# Integration & Deployment (Phase 4)

**Created:** 2026-03-27 **Implementation Plan:** docs/implementation-plans/2026-03-27-0938-integration-deployment.md

**Parent spec:** [Video Encoder App](2026-03-19-1623-video-encoder-app.md) (Phase 4)

---

## Overview

**What:** Production-ready deployment of the video encoder app to a DigitalOcean droplet managed by Laravel Forge, including FFmpeg installation, process management, and a configurable encoding strategy.

**Why:** Phases 1-3 built the server, encoding pipeline, and frontend. This phase makes the app accessible to the design team via a subdomain so they can self-service encode videos instead of relying on CLI FFmpeg commands.

**Type:** Enhancement

---

## Requirements

### Must Have

- [ ] Express serves the Vite client build as static files in production
- [ ] `pnpm build` produces a deployable artifact (client + server)
- [ ] `pnpm start` runs the production server
- [ ] FFmpeg with libsvtav1 and libx264 is installed on the server
- [ ] PM2 keeps the Node process running and restarts on crash
- [ ] Nginx reverse proxies to the Node process (configured via Forge)
- [ ] Encoding mode is configurable via `ENCODE_PARALLEL` env var (default: sequential)

### Nice to Have

- [ ] PM2 log rotation
- [ ] `pm2 startup` for auto-start on server reboot

### Out of Scope

- Domain/DNS/subdomain setup (user handles via Forge)
- CI/CD pipeline (Forge handles deploy-on-push)
- Docker/containerization
- Authentication
- SSL certificate provisioning (Forge + Let's Encrypt)

---

## Design Decisions

### Droplet Size: 2 GB RAM / 1 vCPU / 50 GB SSD ($12/mo)

**Options considered:**

1. **1 GB RAM / 1 vCPU ($6/mo)** — Cheapest, but two FFmpeg processes plus Node could exceed 1 GB and trigger OOM kills.
2. **2 GB RAM / 1 vCPU ($12/mo)** — Comfortable headroom for Node + two FFmpeg processes (~200-400MB each for 30MB input). Encodes are slower on 1 vCPU but acceptable for 3 users.
3. **2 GB RAM / 2 vCPU ($18/mo)** — Faster parallel encodes, but 50% more cost for a low-traffic internal tool.

**Decision:** Option 2. Adequate for the workload, and the droplet can be resized later if encode speed becomes an issue.

### Encoding Strategy: Configurable Parallel vs Sequential

**Options considered:**

1. **Always parallel** — Current behavior (`Promise.allSettled`). Faster on multi-core, but on 1 vCPU both encoders fight for the same core and double memory pressure.
2. **Always sequential** — Simpler, lower peak memory, potentially faster on 1 vCPU since each encoder gets the full core.
3. **Configurable via env var** — `ENCODE_PARALLEL=true|false` lets the operator tune per environment.

**Decision:** Option 3. Default to `false` (sequential) since the target is 1 vCPU. Flip to `true` if the droplet is upgraded.

### FFmpeg Installation: Static Build

**Options considered:**

1. **apt package** — Easy install, but Ubuntu's default FFmpeg package does not include libsvtav1.
2. **johnvansickle static build** — Pre-compiled binary with libsvtav1 included. Download, extract, done.
3. **Compile from source** — Maximum control, but slow and complex for no added benefit.

**Decision:** Option 2 (static build). Simplest path to FFmpeg with AV1 support. One-time manual setup, documented in a server setup guide.

### Process Manager: PM2

**Options considered:**

1. **Forge daemon** — Forge may offer daemon management for Node apps, but this is uncertain and Forge is primarily a Laravel tool.
2. **systemd unit file** — Native to Ubuntu, no extra dependency. Requires writing a unit file.
3. **PM2** — Industry-standard Node process manager. Auto-restart, log management, `pm2 startup` for boot persistence.

**Decision:** PM2. Most ergonomic for a Node app, well-documented, and provides a safety net regardless of what Forge offers.

### Nginx Configuration

**Decision:** Forge generates the nginx config. The app needs a standard reverse proxy from port 80/443 to `localhost:3000`. Document the expected config shape so it can be verified after Forge provisioning.

Expected nginx block:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;  # long timeout for SSE connections
}
```

Note: `proxy_read_timeout` must be high enough to keep SSE connections alive during multi-minute encodes.

---

## Acceptance Criteria

- [ ] `pnpm build && pnpm start` serves the full app (client + API) on a single port
- [ ] Visiting the app's URL in a browser loads the React frontend
- [ ] Uploading and encoding a video works end-to-end on the droplet
- [ ] With `ENCODE_PARALLEL=false`, encodings run sequentially (one finishes before the next starts)
- [ ] With `ENCODE_PARALLEL=true`, encodings run in parallel (both start immediately)
- [ ] `ffmpeg -encoders | grep svtav1` returns a result on the server
- [ ] PM2 restarts the Node process after a simulated crash (`pm2 kill` then verify recovery)
- [ ] SSE progress stream stays connected through the full duration of an encode (nginx doesn't timeout)
- [ ] Temp files are cleaned up after 1 hour on the server

---

## Server Setup Guide

### 1. FFmpeg Installation (one-time)

```bash
# Download latest static build
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

# Extract
tar xf ffmpeg-release-amd64-static.tar.xz

# Move binaries to PATH
sudo mv ffmpeg-*-static/ffmpeg /usr/local/bin/
sudo mv ffmpeg-*-static/ffprobe /usr/local/bin/

# Verify
ffmpeg -encoders 2>/dev/null | grep svtav1
ffmpeg -encoders 2>/dev/null | grep libx264

# Clean up
rm -rf ffmpeg-*-static*
```

### 2. PM2 Setup (one-time)

```bash
# Install PM2 globally
npm install -g pm2

# Start the app (from project root)
pm2 start pnpm --name video-encoder -- start

# Save process list for auto-restart on reboot
pm2 save
pm2 startup  # follow the printed command to enable systemd hook
```

### 3. Environment Variables

Set in Forge's environment configuration or in a `.env` file:

```
PORT=3000
ENCODE_PARALLEL=false
```

---

## Suggested Files to Create/Modify

```
server/src/lib/orchestrator.ts   # Add ENCODE_PARALLEL support (sequential vs parallel encoding)
server/src/index.ts              # Ensure PORT reads from env (already done)
ecosystem.config.cjs             # PM2 config file (optional, alternative to CLI flags)
```
