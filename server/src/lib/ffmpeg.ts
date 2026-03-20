import { spawn } from "node:child_process";

export function encode(
  inputPath: string,
  outputPath: string,
  args: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-i", inputPath, ...args, outputPath]);

    let stderr = "";

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
