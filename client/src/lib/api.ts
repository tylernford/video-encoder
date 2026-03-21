export async function uploadFile(file: File): Promise<{ jobId: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("presetId", "header-video");
  const res = await fetch("/api/encode", { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error ?? "Upload failed");
  }
  return res.json();
}

export function downloadUrl(jobId: string, codec: string): string {
  return `/api/encode/${jobId}/download/${codec}`;
}
