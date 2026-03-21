import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DropZone } from "@/components/DropZone";
import { DownloadButtons } from "@/components/DownloadButtons";
import { useEncodingProgress } from "@/hooks/useEncodingProgress";
import { uploadFile } from "@/lib/api";

type Phase =
  | { name: "idle" }
  | { name: "validationError"; message: string }
  | { name: "uploading" }
  | { name: "encoding"; jobId: string }
  | { name: "done"; jobId: string }
  | { name: "error"; message: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const jobId =
    phase.name === "encoding" || phase.name === "done" ? phase.jobId : null;

  const encoding = useEncodingProgress(jobId);

  // Sync SSE terminal states back to phase
  if (phase.name === "encoding") {
    if (encoding.status === "done") {
      setPhase({ name: "done", jobId: phase.jobId });
    } else if (encoding.status === "error") {
      setPhase({
        name: "error",
        message: encoding.error ?? "Encoding failed",
      });
    }
  }

  const reset = useCallback(() => setPhase({ name: "idle" }), []);

  const handleFile = useCallback(async (file: File) => {
    setPhase({ name: "uploading" });
    try {
      const { jobId } = await uploadFile(file);
      setPhase({ name: "encoding", jobId });
    } catch (err) {
      setPhase({
        name: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }, []);

  const handleValidationError = useCallback((message: string) => {
    setPhase({ name: "validationError", message });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Video Encoder</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(phase.name === "idle" || phase.name === "validationError") && (
            <>
              <DropZone onFile={handleFile} onError={handleValidationError} />
              {phase.name === "validationError" && (
                <p className="text-sm text-destructive">{phase.message}</p>
              )}
            </>
          )}

          {phase.name === "uploading" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Uploading…</p>
              <Progress indeterminate />
            </div>
          )}

          {phase.name === "encoding" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Encoding… {encoding.progress}%
              </p>
              <Progress value={encoding.progress} />
            </div>
          )}

          {phase.name === "done" && jobId && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Encoding complete!
              </p>
              <DownloadButtons jobId={jobId} outputs={encoding.outputs} />
              <Button variant="ghost" onClick={reset}>
                Encode another
              </Button>
            </div>
          )}

          {phase.name === "error" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-destructive">{phase.message}</p>
              <Button variant="outline" onClick={reset}>
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
