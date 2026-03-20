import { type Router as RouterType, Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { createJob, getJob } from "../lib/jobs.js";
import { getPreset } from "../lib/presets.js";
import { startEncoding } from "../lib/orchestrator.js";

const TMP_DIR = path.resolve(import.meta.dirname, "../../tmp");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

const router: RouterType = Router();

router.post("/api/encode", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const presetId =
    typeof req.body.presetId === "string" ? req.body.presetId : "header-video";
  const preset = getPreset(presetId);
  if (!preset) {
    res.status(400).json({ error: `Unknown preset: ${presetId}` });
    return;
  }

  const originalName = path.parse(req.file.originalname).name;
  const job = createJob("", presetId, originalName);
  const jobDir = path.join(TMP_DIR, job.id);
  const filePath = path.join(jobDir, "original.mp4");

  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(filePath, req.file.buffer);

  job.inputPath = filePath;

  void startEncoding(job, preset);

  res.status(201).json({ jobId: job.id });
});

router.get("/api/encode/:jobId/progress", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = () => {
    const data = JSON.stringify({
      status: job.status,
      progress: overallProgress(job.outputs),
      outputs: job.outputs.map((o) => ({
        suffix: o.suffix,
        codec: o.codec,
        status: o.status,
        progress: o.progress,
      })),
    });
    res.write(`data: ${data}\n\n`);
  };

  // Immediate snapshot
  send();

  if (job.status === "done" || job.status === "error") {
    res.end();
    return;
  }

  const onProgress = () => send();
  const onComplete = () => {
    send();
    res.end();
  };

  job.emitter.on("progress", onProgress);
  job.emitter.once("complete", onComplete);

  req.on("close", () => {
    job.emitter.off("progress", onProgress);
    job.emitter.off("complete", onComplete);
  });
});

router.get("/api/encode/:jobId/download/:suffix", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const output = job.outputs.find(
    (o) => o.suffix === `--${req.params.suffix}.mp4`,
  );
  if (!output) {
    res.status(404).json({ error: "Output not found" });
    return;
  }

  if (output.status !== "done" || !output.outputPath) {
    res.status(400).json({ error: "Output not ready" });
    return;
  }

  res.download(
    output.outputPath,
    `${job.originalName}--${req.params.suffix}.mp4`,
  );
});

function overallProgress(outputs: { progress: number }[]): number {
  if (outputs.length === 0) return 0;
  const sum = outputs.reduce((acc, o) => acc + o.progress, 0);
  return Math.round(sum / outputs.length);
}

export default router;
