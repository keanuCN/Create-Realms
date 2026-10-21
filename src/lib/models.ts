export type Modality = "video" | "image";

export interface ModelSpec {
  id: string;
  provider: string;
  modality: Modality;
  label: string;
  tagline: string;
  badge?: string;
  resolutions?: string[];
  defaultResolution?: string;
  durations?: number[];
  defaultDuration?: number;
  ratios?: string[];
  defaultRatio?: string;
  supportsFrames?: boolean;
  supportsReferences?: boolean;
  maxPrompt: number;
  maxImages?: number;
}

export const MODELS: ModelSpec[] = [
  {
    id: "MiniMax-H3-Max",
    provider: "minimax",
    modality: "video",
    label: "H3 Max",
    tagline: "极速视频 · 480P/768P · 5–15 秒",
    badge: "推荐",
    resolutions: ["768P", "480P"],
    defaultResolution: "768P",
    durations: [5, 6, 8, 10, 12, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    maxPrompt: 7000,
  },
  {
    id: "MiniMax-H3",
    provider: "minimax",
    modality: "video",
    label: "H3",
    tagline: "高质量视频 · 768P/2K · 4–15 秒",
    resolutions: ["2K", "768P"],
    defaultResolution: "768P",
    durations: Array.from({ length: 12 }, (_, i) => i + 4),
    defaultDuration: 6,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    maxPrompt: 7000,
  },
  {
    id: "image-01",
    provider: "minimax",
    modality: "image",
    label: "Image 01",
    tagline: "文生图 · 最高 2K · 单次最多 9 张",
    resolutions: [],
    ratios: ["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"],
    defaultRatio: "1:1",
    maxPrompt: 1500,
    maxImages: 9,
  },
];

export function getModel(id: string): ModelSpec | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsByModality(modality: Modality): ModelSpec[] {
  return MODELS.filter((m) => m.modality === modality);
}

export function defaultModel(modality: Modality): ModelSpec {
  return modelsByModality(modality)[0];
}
