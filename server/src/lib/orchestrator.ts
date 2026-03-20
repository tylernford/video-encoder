import path from "node:path";
import type { Job } from "./jobs.js";
import type { Preset } from "./presets.js";
import { probe, encode } from "./ffmpeg.js";

export async function startEncoding(job: Job, preset: Preset): Promise<void> {
  job.status = "encoding";

  let duration: number;
  try {
    duration = await probe(job.inputPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.outputs = preset.encodings.map((enc) => ({
      suffix: enc.suffix,
      codec: enc.codec,
      status: "error" as const,
      progress: 0,
      error: `Probe failed: ${message}`,
    }));
    job.status = "error";
    job.error = `Probe failed: ${message}`;
    job.emitter.emit("complete", job);
    return;
  }

  job.duration = duration;

  job.outputs = preset.encodings.map((enc) => ({
    suffix: enc.suffix,
    codec: enc.codec,
    status: "pending" as const,
    progress: 0,
  }));

  const jobDir = path.dirname(job.inputPath);

  const results = await Promise.allSettled(
    preset.encodings.map((enc, i) => {
      const output = job.outputs[i];
      const outputPath = path.join(jobDir, `${job.originalName}${enc.suffix}`);

      output.status = "encoding";

      return encode(
        job.inputPath,
        outputPath,
        ["-c:v", enc.codec, ...enc.args],
        duration,
        (percent) => {
          output.progress = percent;
          job.emitter.emit("progress", job);
        },
      ).then(() => {
        output.status = "done";
        output.progress = 100;
        output.outputPath = outputPath;
      });
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const output = job.outputs[i];
      output.status = "error";
      const reason = result.reason;
      output.error = reason instanceof Error ? reason.message : String(reason);
    }
  }

  const anySucceeded = job.outputs.some((o) => o.status === "done");

  if (anySucceeded) {
    job.status = "done";
  } else {
    job.status = "error";
    job.error = "All encodings failed";
  }

  job.emitter.emit("complete", job);
}
