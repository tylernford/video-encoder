import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DropZone } from "@/components/DropZone";
import { EncodingOutputCard } from "@/components/EncodingOutputCard";
import {
  VideoIcon,
  SpinnerIcon,
  CheckIcon,
  XCircleIcon,
} from "@/components/icons";
import { useEncodingProgress } from "@/hooks/useEncodingProgress";
import { uploadFile } from "@/lib/api";

type Phase =
  | { name: "idle" }
  | { name: "validationError"; message: string }
  | { name: "uploading"; fileName: string }
  | { name: "encoding"; jobId: string; fileName: string }
  | { name: "done"; jobId: string; fileName: string }
  | { name: "error"; message: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const jobId =
    phase.name === "encoding" || phase.name === "done" ? phase.jobId : null;

  const encoding = useEncodingProgress(jobId);

  // Sync SSE terminal states back to phase
  if (phase.name === "encoding") {
    if (encoding.status === "done") {
      setPhase({ name: "done", jobId: phase.jobId, fileName: phase.fileName });
    } else if (encoding.status === "error") {
      setPhase({
        name: "error",
        message: encoding.error ?? "Encoding failed",
      });
    }
  }

  const reset = useCallback(() => setPhase({ name: "idle" }), []);

  const handleFile = useCallback(async (file: File) => {
    setPhase({ name: "uploading", fileName: file.name });
    try {
      const { jobId } = await uploadFile(file);
      setPhase({ name: "encoding", jobId, fileName: file.name });
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

  const fileName =
    phase.name === "uploading" ||
    phase.name === "encoding" ||
    phase.name === "done"
      ? phase.fileName
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Video Encoder
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop a video and get optimized AV1 &amp; H.264 outputs
          </p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-primary/5">
          <CardContent className="flex flex-col gap-5 p-6">
            {(phase.name === "idle" || phase.name === "validationError") && (
              <>
                <DropZone onFile={handleFile} onError={handleValidationError} />
                {phase.name === "validationError" && (
                  <p className="text-center text-sm text-destructive">
                    {phase.message}
                  </p>
                )}
              </>
            )}

            {phase.name === "uploading" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <VideoIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Uploading…
                    </p>
                  </div>
                </div>
                <Progress indeterminate />
              </div>
            )}

            {phase.name === "encoding" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <SpinnerIcon className="h-4 w-4 animate-spin text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Encoding — {encoding.progress}% overall
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {encoding.outputs.map((output) => (
                    <EncodingOutputCard
                      key={output.codec}
                      output={output}
                      jobId={jobId!}
                    />
                  ))}
                </div>
              </div>
            )}

            {phase.name === "done" && jobId && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
                    <CheckIcon className="h-4 w-4 text-success" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fileName}
                    </p>
                    <p className="text-xs text-success">Encoding complete</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {encoding.outputs.map((output) => (
                    <EncodingOutputCard
                      key={output.codec}
                      output={output}
                      jobId={jobId}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  onClick={reset}
                  className="text-muted-foreground"
                >
                  Encode another video
                </Button>
              </div>
            )}

            {phase.name === "error" && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <XCircleIcon className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-center text-sm text-destructive">
                  {phase.message}
                </p>
                <Button variant="outline" onClick={reset}>
                  Try again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
