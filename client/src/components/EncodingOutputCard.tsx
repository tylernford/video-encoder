import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { CheckIcon, DownloadIcon } from "@/components/icons";
import { downloadUrl } from "@/lib/api";
import type { EncodingOutput } from "@/hooks/useEncodingProgress";

type EncodingOutputCardProps = {
  output: EncodingOutput;
  jobId: string;
};

const CODEC_LABELS: Record<string, string> = {
  libsvtav1: "AV1",
  libx264: "H.264",
};

function suffixToParam(suffix: string): string {
  return suffix.replace(/^--/, "").replace(/\.mp4$/, "");
}

export function EncodingOutputCard({ output, jobId }: EncodingOutputCardProps) {
  const label = CODEC_LABELS[output.codec] ?? output.codec;
  const param = suffixToParam(output.suffix);
  const isDone = output.status === "done";
  const isError = output.status === "error";
  const isEncoding = output.status === "encoding";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition-all duration-200",
        isDone && "border-success/30 bg-success/5",
        isError && "border-destructive/30 bg-destructive/5",
        !isDone && !isError && "border-border bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-white",
            )}
          >
            {label}
          </span>
          <span className="text-sm text-muted-foreground">
            {isDone && "Complete"}
            {isEncoding && `${output.progress}%`}
            {output.status === "pending" && "Waiting…"}
            {isError && "Failed"}
          </span>
        </div>
        {isDone && <CheckIcon className="h-4 w-4 text-success" />}
      </div>

      {(isEncoding || output.status === "pending") && (
        <Progress
          value={output.progress}
          indeterminate={output.status === "pending"}
        />
      )}

      {isDone && (
        <a
          href={downloadUrl(jobId, param)}
          download
          className={cn(
            buttonVariants({ size: "sm" }),
            "gap-2 bg-primary text-white shadow-md hover:shadow-lg transition-shadow",
          )}
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Download {label}
        </a>
      )}
    </div>
  );
}
