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
  /** 支持首帧参考图 */
  supportsFrames?: boolean;
  /** 支持尾帧（首尾帧生成） */
  supportsLastFrame?: boolean;
  maxPrompt: number;
  maxImages?: number;
  note?: string;
}

/** 客户端可用的供应商展示名（服务端目录在 lib/providers.ts）。 */
export const PROVIDER_LABELS: Record<string, string> = {
  minimax: "MiniMax 海螺",
  "volcengine-ark": "即梦 / 豆包",
  kling: "可灵 Kling",
  pixverse: "PixVerse",
  vidu: "Vidu",
  dashscope: "通义万相 / HappyHorse",
};

export const PROVIDER_ORDER = [
  "minimax",
  "volcengine-ark",
  "kling",
  "pixverse",
  "vidu",
  "dashscope",
];

const COMMON_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];

export const MODELS: ModelSpec[] = [
  /* ------------------------------- MiniMax ------------------------------- */
  {
    id: "MiniMax-H3-Max",
    provider: "minimax",
    modality: "video",
    label: "H3 Max",
    tagline: "极速 · 480P/768P · 5–15 秒",
    badge: "推荐",
    resolutions: ["768P", "480P"],
    defaultResolution: "768P",
    durations: [5, 6, 8, 10, 12, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 7000,
  },
  {
    id: "MiniMax-H3",
    provider: "minimax",
    modality: "video",
    label: "H3",
    tagline: "高质量 · 768P/2K · 4–15 秒",
    resolutions: ["2K", "768P"],
    defaultResolution: "768P",
    durations: Array.from({ length: 12 }, (_, i) => i + 4),
    defaultDuration: 6,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 7000,
  },
  {
    id: "image-01",
    provider: "minimax",
    modality: "image",
    label: "Image 01",
    tagline: "文生图 · 最多一次 4 张",
    ratios: ["1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"],
    defaultRatio: "1:1",
    maxPrompt: 1500,
    maxImages: 4,
  },

  /* --------------------------------- 可灵 ---------------------------------- */
  {
    id: "kling-3.0",
    provider: "kling",
    modality: "video",
    label: "可灵 3.0",
    tagline: "最高 4K · 3–15 秒 · 支持首尾帧",
    badge: "推荐",
    resolutions: ["1080p", "720p", "4k"],
    defaultResolution: "1080p",
    durations: [3, 5, 8, 10, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2500,
  },
  {
    id: "kling-2.6",
    provider: "kling",
    modality: "video",
    label: "可灵 2.6",
    tagline: "5/10 秒 · 720p/1080p",
    resolutions: ["1080p", "720p"],
    defaultResolution: "1080p",
    durations: [5, 10],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2500,
  },
  {
    id: "kling-3.0-turbo",
    provider: "kling",
    modality: "video",
    label: "可灵 3.0 Turbo",
    tagline: "更快 · 3–15 秒 · 仅首帧",
    resolutions: ["1080p", "720p"],
    defaultResolution: "1080p",
    durations: [3, 5, 8, 10, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1"],
    defaultRatio: "16:9",
    supportsFrames: true,
    maxPrompt: 2500,
  },

  /* ---------------------------- 火山方舟 Seedance ---------------------------- */
  {
    id: "doubao-seedance-2-5-260628",
    provider: "volcengine-ark",
    modality: "video",
    label: "Seedance 2.5",
    tagline: "支持音频 · 480p–1080p · 4–30 秒",
    badge: "推荐",
    resolutions: ["1080p", "720p", "480p"],
    defaultResolution: "720p",
    durations: [5, 8, 10, 15, 20, 30],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2000,
  },
  {
    id: "doubao-seedance-2-0-fast-260128",
    provider: "volcengine-ark",
    modality: "video",
    label: "Seedance 2.0 Fast",
    tagline: "更快更省 · 480p/720p · 4–15 秒",
    resolutions: ["720p", "480p"],
    defaultResolution: "720p",
    durations: [4, 5, 8, 10, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2000,
  },
  {
    id: "doubao-seedream-5-0-pro-260628",
    provider: "volcengine-ark",
    modality: "image",
    label: "Seedream 5.0 Pro",
    tagline: "文生图 · 最高 2K",
    badge: "推荐",
    resolutions: ["2K", "1.5K", "1K"],
    defaultResolution: "2K",
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
    defaultRatio: "1:1",
    maxPrompt: 3000,
    maxImages: 4,
  },

  /* -------------------------------- PixVerse -------------------------------- */
  {
    id: "v6-max",
    provider: "pixverse",
    modality: "video",
    label: "PixVerse V6 Max",
    tagline: "旗舰 · 360p–1080p · 1–15 秒",
    badge: "推荐",
    resolutions: ["1080p", "720p", "540p", "360p"],
    defaultResolution: "720p",
    durations: [5, 8, 10, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "2:3", "3:2", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    maxPrompt: 2000,
    note: "V6 Max 支持文生视频与首帧图生视频，不支持首尾帧",
  },
  {
    id: "v6",
    provider: "pixverse",
    modality: "video",
    label: "PixVerse V6",
    tagline: "支持首尾帧 · 360p–1080p",
    resolutions: ["1080p", "720p", "540p", "360p"],
    defaultResolution: "720p",
    durations: [5, 8, 10, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2000,
  },
  {
    id: "v5.6",
    provider: "pixverse",
    modality: "video",
    label: "PixVerse V5.6",
    tagline: "性价比 · 5/8/10 秒",
    resolutions: ["1080p", "720p", "540p"],
    defaultResolution: "720p",
    durations: [5, 8, 10],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2000,
  },

  /* ---------------------------------- Vidu ---------------------------------- */
  {
    id: "viduq3-pro",
    provider: "vidu",
    modality: "video",
    label: "Vidu Q3 Pro",
    tagline: "音画直出 · 540p–1080p · 1–16 秒",
    badge: "推荐",
    resolutions: ["1080p", "720p", "540p"],
    defaultResolution: "720p",
    durations: [5, 8, 10, 12, 16],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2000,
  },
  {
    id: "viduq3-turbo",
    provider: "vidu",
    modality: "video",
    label: "Vidu Q3 Turbo",
    tagline: "更快 · 540p–1080p",
    resolutions: ["1080p", "720p", "540p"],
    defaultResolution: "720p",
    durations: [5, 8, 10, 16],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2000,
  },

  /* ------------------------- 阿里百炼 通义万相 / HappyHorse ------------------------- */
  {
    id: "happyhorse-1.1-t2v",
    provider: "dashscope",
    modality: "video",
    label: "HappyHorse 1.1",
    tagline: "阿里最新 · 480P–1080P · 3–15 秒",
    badge: "推荐",
    resolutions: ["1080P", "720P", "480P"],
    defaultResolution: "720P",
    durations: [5, 8, 10, 12, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    maxPrompt: 2000,
    note: "选择首帧后自动改用 happyhorse-1.1-i2v",
  },
  {
    id: "wan2.7-t2v",
    provider: "dashscope",
    modality: "video",
    label: "通义万相 2.7",
    tagline: "720P/1080P · 2–15 秒 · 支持首尾帧",
    resolutions: ["1080P", "720P"],
    defaultResolution: "720P",
    durations: [5, 8, 10, 15],
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    maxPrompt: 2000,
    note: "选择图片后自动改用 wan2.7-i2v",
  },
  {
    id: "wan2.6-t2i",
    provider: "dashscope",
    modality: "image",
    label: "万相 2.6 文生图",
    tagline: "文生图 · 1280 级尺寸",
    resolutions: ["1280"],
    defaultResolution: "1280",
    ratios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultRatio: "1:1",
    maxPrompt: 2000,
    maxImages: 4,
  },
];

export function getModel(id: string): ModelSpec | undefined {
  return MODELS.find((model) => model.id === id);
}

export function modelsByModality(modality: Modality): ModelSpec[] {
  return MODELS.filter((model) => model.modality === modality);
}

export function providersForModality(modality: Modality): string[] {
  const seen = new Set<string>();
  for (const model of modelsByModality(modality)) seen.add(model.provider);
  return PROVIDER_ORDER.filter((provider) => seen.has(provider));
}

export function modelsFor(modality: Modality, provider: string): ModelSpec[] {
  return MODELS.filter(
    (model) => model.modality === modality && model.provider === provider,
  );
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function defaultModel(modality: Modality, provider?: string): ModelSpec {
  const pool = provider ? modelsFor(modality, provider) : modelsByModality(modality);
  return pool[0] ?? MODELS[0];
}

export { COMMON_RATIOS };