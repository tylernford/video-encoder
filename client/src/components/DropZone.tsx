import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MAX_SIZE = 30 * 1024 * 1024; // 30MB

type DropZoneProps = {
  onFile: (file: File) => void;
  onError: (message: string) => void;
};

function validate(file: File): string | null {
  if (!file.type.startsWith("video/")) {
    return "Only video files are accepted";
  }
  if (file.size > MAX_SIZE) {
    return "File must be under 30 MB";
  }
  return null;
}

export function DropZone({ onFile, onError }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const error = validate(file);
      if (error) {
        onError(error);
      } else {
        onFile(file);
      }
    },
    [onFile, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-sm text-muted-foreground transition-colors",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
      )}
    >
      <span className="text-base font-medium text-foreground">
        Drop a video file here
      </span>
      <span>or click to browse</span>
      <span className="text-xs">Video files up to 30 MB</span>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleChange}
        className="hidden"
      />
    </button>
  );
}
