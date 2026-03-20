import { type Router as RouterType, Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { createJob } from "../lib/jobs.js";

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

  const job = createJob("", "header-video");
  const jobDir = path.join(TMP_DIR, job.id);
  const filePath = path.join(jobDir, "original.mp4");

  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(filePath, req.file.buffer);

  job.inputPath = filePath;

  res.status(201).json({ jobId: job.id });
});

export default router;
