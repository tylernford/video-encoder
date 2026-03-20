import { spawn } from "node:child_process";

export function probe(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      inputPath,
    ]);

    let stdout = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`));
        return;
      }
      try {
        const data = JSON.parse(stdout) as {
          format?: { duration?: string };
        };
        const duration = parseFloat(data.format?.duration ?? "");
        if (Number.isNaN(duration)) {
          reject(new Error("ffprobe returned no duration"));
          return;
        }
        resolve(duration);
      } catch {
        reject(new Error("Failed to parse ffprobe output"));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

export function encode(
  inputPath: string,
  outputPath: string,
  args: string[],
  duration: number,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-i",
      inputPath,
      ...args,
      "-progress",
      "pipe:1",
      outputPath,
    ]);

    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      if (!onProgress) return;
      const lines = chunk.toString().split("\n");
      for (const line of lines) {
        if (line.startsWith("out_time_us=")) {
          const us = parseInt(line.slice("out_time_us=".length), 10);
          if (!Number.isNaN(us) && duration > 0) {
            const seconds = us / 1_000_000;
            const percent = Math.min(
              100,
              Math.max(0, (seconds / duration) * 100),
            );
            onProgress(percent);
          }
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}:\n${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}
