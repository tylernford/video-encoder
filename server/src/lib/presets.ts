type EncodingConfig = {
  codec: string;
  args: string[];
  suffix: string;
};

type Preset = {
  id: string;
  label: string;
  encodings: EncodingConfig[];
};

const presets: Preset[] = [
  {
    id: "header-video",
    label: "Header Video",
    encodings: [
      {
        codec: "libsvtav1",
        args: ["-crf", "35", "-preset", "4", "-an", "-movflags", "+faststart"],
        suffix: "--av1.mp4",
      },
      {
        codec: "libx264",
        args: [
          "-crf",
          "25",
          "-preset",
          "slow",
          "-an",
          "-movflags",
          "+faststart",
        ],
        suffix: "--h264.mp4",
      },
    ],
  },
];

export function getPreset(id: string): Preset | undefined {
  return presets.find((p) => p.id === id);
}

export function getAllPresets(): Preset[] {
  return presets;
}

export type { EncodingConfig, Preset };
