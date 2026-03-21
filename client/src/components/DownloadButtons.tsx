import { buttonVariants } from "@/components/ui/button";
import { downloadUrl } from "@/lib/api";
import type { EncodingOutput } from "@/hooks/useEncodingProgress";

type DownloadButtonsProps = {
  jobId: string;
  outputs: EncodingOutput[];
};

const CODEC_LABELS: Record<string, string> = {
  av1: "AV1",
  h264: "H.264",
};

/** Extract route param from suffix, e.g. "--av1.mp4" → "av1" */
function suffixToParam(suffix: string): string {
  return suffix.replace(/^--/, "").replace(/\.mp4$/, "");
}

export function DownloadButtons({ jobId, outputs }: DownloadButtonsProps) {
  return (
    <div className="flex gap-3">
      {outputs
        .filter((o) => o.status === "done")
        .map((o) => {
          const param = suffixToParam(o.suffix);
          return (
            <a
              key={o.codec}
              href={downloadUrl(jobId, param)}
              download
              className={buttonVariants()}
            >
              Download {CODEC_LABELS[param] ?? param}
            </a>
          );
        })}
    </div>
  );
}
