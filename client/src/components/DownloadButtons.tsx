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

export function DownloadButtons({ jobId, outputs }: DownloadButtonsProps) {
  return (
    <div className="flex gap-3">
      {outputs
        .filter((o) => o.status === "done")
        .map((o) => (
          <a
            key={o.codec}
            href={downloadUrl(jobId, o.codec)}
            download
            className={buttonVariants()}
          >
            Download {CODEC_LABELS[o.codec] ?? o.codec}
          </a>
        ))}
    </div>
  );
}
