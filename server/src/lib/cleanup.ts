import fs from "node:fs/promises";
import path from "node:path";

const TMP_DIR = path.resolve(import.meta.dirname, "../../tmp");
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function cleanJobDir(dirPath: string): Promise<void> {
  const files = await fs.readdir(dirPath);
  const now = Date.now();

  const allExpired = await Promise.all(
    files.map(async (file) => {
      const stat = await fs.stat(path.join(dirPath, file));
      return now - stat.mtimeMs > MAX_AGE_MS;
    }),
  );

  if (files.length > 0 && allExpired.every(Boolean)) {
    await fs.rm(dirPath, { recursive: true });
  }
}

async function sweep(): Promise<void> {
  await fs.mkdir(TMP_DIR, { recursive: true });

  const entries = await fs.readdir(TMP_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      await cleanJobDir(path.join(TMP_DIR, entry.name));
    }
  }
}

export function startCleanup(): void {
  sweep();
  setInterval(sweep, INTERVAL_MS);
}
