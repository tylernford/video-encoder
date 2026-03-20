import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import encodeRouter from "./routes/encode.js";
import { startCleanup } from "./lib/cleanup.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(encodeRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof Error && err.message === "Only video files are allowed") {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  startCleanup();
});
