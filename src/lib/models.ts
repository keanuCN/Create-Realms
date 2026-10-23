export type Modality = "video" | "image";

export interface DurationRange {
  min: number;
  max: number;
  step?: number;
}

export interface ModelSpec {
  id: string;
  /** 未开放的型号只展示，不允许提交生成任务。 */
  availability?: "available" | "coming-soon";
  provider: string;
  modality: Modality;
  label: string;
  tagline: string;
  badge?: string;
  resolutions?: string[];
  defaultResolution?: string;
  /** 时长区间（视频用滑块选择） */
  durationRange?: DurationRange;
  /** 可选时长不是等差数列时直接列出（如 5/8/10） */
  durationList?: number[];
  defaultDuration?: number;
  ratios?: string[];
  defaultRatio?: string;
  /** 支持首帧参考图 */
  supportsFrames?: boolean;
  /** 支持尾帧（首尾帧生成） */
  supportsLastFrame?: boolean;
  /** 支持多张主体/风格参考图（参考生视频） */
  supportsReferenceImages?: boolean;
  maxReferenceImages?: number;
  /** 支持音画同出 */
  supportsAudio?: boolean;
  audioDefault?: boolean;
  /** 支持提示词扩写 */
  supportsPromptOptimizer?: boolean;
  promptOptimizerHint?: string;
  /** 单次最多生成几条（同一提示词多份） */
  maxVideos?: number;
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
  dashscope: "通义万相 / 千问 / HappyHorse",
  openai: "OpenAI",
  google: "Google Gemini",
};

export const PROVIDER_ORDER = [
  "minimax",
  "volcengine-ark",
  "kling",
  "pixverse",
  "vidu",
  "dashscope",
  "openai",
  "google",
];

const WIDE_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
const STD_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];

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
    durationRange: { min: 5, max: 15 },
    defaultDuration: 5,
    ratios: WIDE_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsReferenceImages: true,
    maxReferenceImages: 9,
    supportsPromptOptimizer: true,
    promptOptimizerHint: "支持关闭 / 均衡 / 高质量三档扩写",
    maxVideos: 4,
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
    durationRange: { min: 4, max: 15 },
    defaultDuration: 6,
    ratios: WIDE_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsReferenceImages: true,
    maxReferenceImages: 9,
    maxVideos: 4,
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
    supportsPromptOptimizer: true,
    maxPrompt: 1500,
    maxImages: 4,
  },

  /* --------------------------------- 可灵 ---------------------------------- */
  {
    id: "kling-3.0",
    provider: "kling",
    modality: "video",
    label: "可灵 3.0",
    tagline: "最高 4K · 3–15 秒 · 支持首尾帧与音频",
    badge: "推荐",
    resolutions: ["1080p", "720p", "4k"],
    defaultResolution: "1080p",
    durationRange: { min: 3, max: 15 },
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 4,
    maxPrompt: 2500,
  },
  {
    id: "kling-2.6",
    provider: "kling",
    modality: "video",
    label: "可灵 2.6",
    tagline: "5/10 秒 · 720p/1080p · 支持音频",
    resolutions: ["1080p", "720p"],
    defaultResolution: "1080p",
    durationRange: { min: 5, max: 10, step: 5 },
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 4,
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
    durationRange: { min: 3, max: 15 },
    defaultDuration: 5,
    ratios: ["16:9", "9:16", "1:1"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 4,
    maxPrompt: 2500,
  },
  {
    id: "kling-4.0-preview",
    availability: "coming-soon",
    provider: "kling",
    modality: "video",
    label: "可灵 4.0",
    tagline: "API 抢先体验开放中，普通接入暂未开放",
    badge: "暂未开放",
    resolutions: ["1080p", "720p"],
    defaultResolution: "1080p",
    durationRange: { min: 3, max: 30 },
    defaultDuration: 5,
    ratios: ["21:9", "16:9", "1:1", "9:16"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 1,
    maxPrompt: 8000,
    note: "官方 API 目前处于抢先体验阶段；获得官方开放资格并完成适配后再启用",
  },

  /* ---------------------------- 火山方舟 Seedance ---------------------------- */
  {
    id: "doubao-seedance-2-5-260628",
    provider: "volcengine-ark",
    modality: "video",
    label: "Seedance 2.5",
    tagline: "音画同出 · 480p–1080p · 4–30 秒",
    badge: "推荐",
    resolutions: ["1080p", "720p", "480p"],
    defaultResolution: "720p",
    durationRange: { min: 4, max: 30 },
    defaultDuration: 5,
    ratios: WIDE_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsReferenceImages: true,
    maxReferenceImages: 4,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 4,
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
    durationRange: { min: 4, max: 15 },
    defaultDuration: 5,
    ratios: WIDE_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 4,
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
    supportsPromptOptimizer: true,
    maxPrompt: 3000,
    maxImages: 4,
  },
  {
    id: "doubao-seedream-5-0-flash-260915",
    provider: "volcengine-ark",
    modality: "image",
    label: "Seedream 5.0 Flash",
    tagline: "快速出图 · 支持透明背景 · 1K–2K",
    badge: "快速",
    resolutions: ["2K", "1.5K", "1K"],
    defaultResolution: "1.5K",
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
    defaultRatio: "1:1",
    supportsPromptOptimizer: true,
    maxPrompt: 3000,
    maxImages: 4,
  },

  /* -------------------------------- PixVerse -------------------------------- */
  {
    id: "c1",
    provider: "pixverse",
    modality: "video",
    label: "PixVerse C1",
    tagline: "电影级动作与特效 · 360p–1080p · 1–15 秒",
    badge: "新模型",
    resolutions: ["1080p", "720p", "540p", "360p"],
    defaultResolution: "720p",
    durationRange: { min: 1, max: 15 },
    defaultDuration: 5,
    ratios: [...STD_RATIOS, "2:3", "3:2", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: false,
    maxVideos: 4,
    maxPrompt: 5000,
    note: "擅长电影感画面、复杂动作和特效；支持文生、图生、首尾帧与音画生成",
  },
  {
    id: "v6-max",
    provider: "pixverse",
    modality: "video",
    label: "PixVerse V6 Max",
    tagline: "旗舰 · 360p–1080p · 1–15 秒",
    badge: "推荐",
    resolutions: ["1080p", "720p", "540p", "360p"],
    defaultResolution: "720p",
    durationRange: { min: 1, max: 15 },
    defaultDuration: 5,
    ratios: [...STD_RATIOS, "2:3", "3:2", "21:9"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsAudio: true,
    audioDefault: false,
    maxVideos: 4,
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
    durationRange: { min: 1, max: 15 },
    defaultDuration: 5,
    ratios: STD_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: false,
    maxVideos: 4,
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
    durationList: [5, 8, 10],
    defaultDuration: 5,
    ratios: STD_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: false,
    maxVideos: 4,
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
    durationRange: { min: 1, max: 16 },
    defaultDuration: 5,
    ratios: STD_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 4,
    maxPrompt: 2000,
  },
  {
    id: "viduq3-turbo",
    provider: "vidu",
    modality: "video",
    label: "Vidu Q3 Turbo",
    tagline: "更快 · 540p–1080p · 支持音频",
    resolutions: ["1080p", "720p", "540p"],
    defaultResolution: "720p",
    durationRange: { min: 1, max: 16 },
    defaultDuration: 5,
    ratios: STD_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 4,
    maxPrompt: 2000,
  },

  /* ------------------------- 阿里百炼 通义万相 / HappyHorse ------------------------- */
  {
    id: "wan2.7-image-pro",
    provider: "dashscope",
    modality: "image",
    label: "通义万相 2.7 Pro",
    tagline: "高精度文字与品牌色 · 文生图最高 4K",
    badge: "推荐",
    resolutions: ["4K", "2K", "1K"],
    defaultResolution: "2K",
    ratios: [...WIDE_RATIOS, "2:3", "3:2"],
    defaultRatio: "1:1",
    supportsPromptOptimizer: true,
    maxPrompt: 5000,
    maxImages: 4,
  },
  {
    id: "wan2.7-image",
    provider: "dashscope",
    modality: "image",
    label: "通义万相 2.7",
    tagline: "快速生成与图片编辑 · 最高 2K",
    resolutions: ["2K", "1K"],
    defaultResolution: "2K",
    ratios: [...WIDE_RATIOS, "2:3", "3:2"],
    defaultRatio: "1:1",
    supportsPromptOptimizer: true,
    maxPrompt: 5000,
    maxImages: 4,
  },
  {
    id: "qwen-image-3.0-pro",
    provider: "dashscope",
    modality: "image",
    label: "千问图像 3.0 Pro",
    tagline: "复杂版式与中文文字 · 文生图 / 编辑 · 最高 2K",
    badge: "推荐",
    resolutions: ["2K", "1K"],
    defaultResolution: "2K",
    ratios: [...WIDE_RATIOS, "2:3", "3:2"],
    defaultRatio: "1:1",
    supportsPromptOptimizer: true,
    maxPrompt: 800,
    maxImages: 4,
  },
  {
    id: "qwen-image-3.0",
    provider: "dashscope",
    modality: "image",
    label: "千问图像 3.0",
    tagline: "兼顾文字渲染与生成速度 · 最高 2K",
    resolutions: ["2K", "1K"],
    defaultResolution: "2K",
    ratios: [...WIDE_RATIOS, "2:3", "3:2"],
    defaultRatio: "1:1",
    supportsPromptOptimizer: true,
    maxPrompt: 800,
    maxImages: 4,
  },
  {
    id: "wan3.0-video-prime",
    provider: "dashscope",
    modality: "video",
    label: "通义万相 3.0 Prime",
    tagline: "全能参考生视频 · 最长 30 秒 · 30fps",
    badge: "预览",
    resolutions: ["1080P", "720P", "480P"],
    defaultResolution: "720P",
    durationRange: { min: 2, max: 30 },
    defaultDuration: 5,
    ratios: [...WIDE_RATIOS],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsReferenceImages: true,
    maxReferenceImages: 10,
    supportsAudio: true,
    audioDefault: true,
    supportsPromptOptimizer: true,
    promptOptimizerHint: "对应百炼的提示词改写（prompt_extend）",
    maxVideos: 1,
    maxPrompt: 20000,
    note: "高速预览版；支持文生、首尾帧和参考图；媒体输入类型不可与首尾帧混用",
  },
  {
    id: "wan3.0-video",
    provider: "dashscope",
    modality: "video",
    label: "通义万相 3.0",
    tagline: "全能参考生视频 · 最长 30 秒 · 30fps",
    badge: "预览",
    resolutions: ["1080P", "720P", "480P"],
    defaultResolution: "720P",
    durationRange: { min: 2, max: 30 },
    defaultDuration: 5,
    ratios: [...WIDE_RATIOS],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsReferenceImages: true,
    maxReferenceImages: 10,
    supportsAudio: true,
    audioDefault: true,
    supportsPromptOptimizer: true,
    promptOptimizerHint: "对应百炼的提示词改写（prompt_extend）",
    maxVideos: 1,
    maxPrompt: 20000,
    note: "支持文生、首尾帧和参考图；媒体输入类型不可与首尾帧混用",
  },
  {
    id: "happyhorse-1.1-t2v",
    provider: "dashscope",
    modality: "video",
    label: "HappyHorse 1.1",
    tagline: "阿里最新 · 480P–1080P · 3–15 秒",
    badge: "推荐",
    resolutions: ["1080P", "720P", "480P"],
    defaultResolution: "720P",
    durationRange: { min: 3, max: 15 },
    defaultDuration: 5,
    ratios: WIDE_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsPromptOptimizer: true,
    promptOptimizerHint: "对应百炼的提示词改写（prompt_extend）",
    maxVideos: 4,
    maxPrompt: 2000,
    note: "选择参考图后自动改用 happyhorse-1.1-i2v",
  },
  {
    id: "wan2.7-t2v",
    provider: "dashscope",
    modality: "video",
    label: "通义万相 2.7",
    tagline: "720P/1080P · 2–15 秒 · 支持首尾帧",
    resolutions: ["1080P", "720P"],
    defaultResolution: "720P",
    durationRange: { min: 2, max: 15 },
    defaultDuration: 5,
    ratios: STD_RATIOS,
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsPromptOptimizer: true,
    maxVideos: 4,
    maxPrompt: 2000,
    note: "选择首帧后自动改用 wan2.7-i2v",
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
    supportsPromptOptimizer: true,
    maxPrompt: 2000,
    maxImages: 4,
  },

  /* ------------------------- OpenAI GPT Image ------------------------- */
  {
    id: "gpt-image-2.5-sunburst",
    provider: "openai",
    modality: "image",
    label: "GPT Image 2.5 Sunburst",
    tagline: "旗舰画质 · 复杂指令与图片编辑",
    badge: "旗舰",
    resolutions: ["1K"],
    defaultResolution: "1K",
    ratios: ["1:1", "3:2", "2:3"],
    defaultRatio: "1:1",
    maxPrompt: 4000,
    maxImages: 4,
  },
  {
    id: "gpt-image-2.5-flare",
    provider: "openai",
    modality: "image",
    label: "GPT Image 2.5 Flare",
    tagline: "文生图 / 参考图编辑 · 快速高质量",
    badge: "推荐",
    resolutions: ["1K"],
    defaultResolution: "1K",
    ratios: ["1:1", "3:2", "2:3"],
    defaultRatio: "1:1",
    maxPrompt: 4000,
    maxImages: 4,
  },

  /* ------------------------- Google Gemini ------------------------- */
  {
    id: "gemini-3.1-flash-image",
    provider: "google",
    modality: "image",
    label: "Nano Banana 2",
    tagline: "新一代通用出图 · 0.5K–4K · 支持图片编辑",
    badge: "推荐",
    resolutions: ["4K", "2K", "1K", "0.5K"],
    defaultResolution: "1K",
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"],
    defaultRatio: "1:1",
    maxPrompt: 4000,
    maxImages: 4,
  },
  {
    id: "gemini-3.1-flash-lite-image",
    provider: "google",
    modality: "image",
    label: "Nano Banana 2 Lite",
    tagline: "轻量快速 · 1K · 支持图片编辑",
    badge: "快速",
    resolutions: ["1K"],
    defaultResolution: "1K",
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"],
    defaultRatio: "1:1",
    maxPrompt: 4000,
    maxImages: 4,
  },
  {
    id: "gemini-3-pro-image",
    provider: "google",
    modality: "image",
    label: "Nano Banana Pro",
    tagline: "专业视觉资产 · 复杂版式与精准文字 · 最高 4K",
    badge: "旗舰",
    resolutions: ["4K", "2K", "1K"],
    defaultResolution: "2K",
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"],
    defaultRatio: "1:1",
    maxPrompt: 4000,
    maxImages: 4,
  },
  {
    id: "gemini-nano-banana-2.1",
    provider: "google",
    modality: "image",
    label: "Nano Banana 2.1",
    tagline: "Gemini 文生图 / 参考图编辑 · 最高 4K",
    badge: "推荐",
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "1K",
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
    defaultRatio: "1:1",
    maxPrompt: 4000,
    maxImages: 4,
  },
  {
    id: "gemini-omni-1.1-flash",
    provider: "google",
    modality: "video",
    label: "Gemini Omni Flash",
    tagline: "Gemini 音画生成 · 首尾帧 / 参考图 · 360p–4K",
    badge: "推荐",
    resolutions: ["720p", "1080p", "4k", "360p"],
    defaultResolution: "720p",
    durationList: [5, 8, 10],
    defaultDuration: 8,
    ratios: ["16:9", "9:16"],
    defaultRatio: "16:9",
    supportsFrames: true,
    supportsLastFrame: true,
    supportsReferenceImages: true,
    maxReferenceImages: 3,
    supportsAudio: true,
    audioDefault: true,
    maxVideos: 4,
    maxPrompt: 4000,
    note: "时长按提示词向 Gemini 表达，结果以模型实际输出为准",
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

/** 时长是否在该模型允许范围内 */
export function durationAllowed(model: ModelSpec, duration: number): boolean {
  if (!Number.isInteger(duration)) return false;
  if (model.durationList?.length) return model.durationList.includes(duration);
  const range = model.durationRange;
  if (!range) return false;
  if (duration < range.min || duration > range.max) return false;
  const step = range.step ?? 1;
  return (duration - range.min) % step === 0;
}

/** 该模型可选的全部时长，滑块按这个列表走 */
export function durationOptions(model: ModelSpec): number[] {
  if (model.durationList?.length) return [...model.durationList];
  const range = model.durationRange;
  if (!range) return [];
  const step = range.step ?? 1;
  const list: number[] = [];
  for (let value = range.min; value <= range.max; value += step) list.push(value);
  return list;
}

/* -------------------------------------------------------------------------- */
/* 参考单价                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 价格调研时间。页面会标注这个日期，避免被当成实时报价。
 */
export const PRICING_AS_OF = "2026-10-23";
const USD_TO_CNY = 6.718;

/**
 * 参考单价。内部保留各平台原生计费单位，展示时统一换算成人民币：
 * - MiniMax 国际站：按 2026-10-23 中国银行美元中间价换算
 * - 可灵积分：按 1 积分约 1 元换算
 * - Vidu 积分：按官方标注 1 积分 = 0.03125 元换算
 * - 通义万相：人民币原价
 * 未收录的模型（火山方舟、HappyHorse、OpenAI、Google 等）界面上提示「见控制台」。
 */
export interface ModelPricing {
  /** 计费维度 */
  unit: "second" | "image";
  /** 显示单位：$ / ¥ / 积分 */
  symbol: string;
  /** 一个原生计费单位对应的人民币金额 */
  rmbPerUnit: number;
  /** 按分辨率给出的单价，键与 ModelSpec.resolutions 对应 */
  byResolution?: Record<string, number>;
  /** 与分辨率无关的单一价格 */
  flat?: number;
  /** 换算关系、是否含音频等补充说明 */
  note?: string;
}

const PRICING: Record<string, ModelPricing> = {
  "MiniMax-H3-Max": {
    unit: "second",
    symbol: "$",
    rmbPerUnit: USD_TO_CNY,
    byResolution: { "768P": 0.08, "480P": 0.05 },
    note: "按国际站美元参考价折算人民币；国内站以控制台为准，参考图超出免费张数另计",
  },
  "MiniMax-H3": {
    unit: "second",
    symbol: "$",
    rmbPerUnit: USD_TO_CNY,
    byResolution: { "768P": 0.08, "2K": 0.13 },
    note: "按国际站美元参考价折算人民币；国内站以控制台为准",
  },
  "image-01": {
    unit: "image",
    symbol: "$",
    rmbPerUnit: USD_TO_CNY,
    flat: 0.0035,
    note: "按国际站美元参考价折算人民币",
  },
  "kling-3.0": {
    unit: "second",
    symbol: "积分",
    rmbPerUnit: 1,
    byResolution: { "720p": 0.6, "1080p": 0.8, "4k": 3.0 },
    note: "无声参考价；开启音频后费用更高",
  },
  "kling-2.6": {
    unit: "second",
    symbol: "积分",
    rmbPerUnit: 1,
    byResolution: { "720p": 0.3, "1080p": 0.5 },
    note: "无声参考价",
  },
  "kling-3.0-turbo": {
    unit: "second",
    symbol: "积分",
    rmbPerUnit: 1,
    byResolution: { "720p": 0.8, "1080p": 1.0 },
    note: "人民币参考价",
  },
  v6: {
    unit: "second",
    symbol: "积分",
    rmbPerUnit: USD_TO_CNY / 225,
    byResolution: { "720p": 9 },
    note: "静音约 ¥0.27/秒，开音频约 ¥0.36/秒；按平台外币折算，仅作参考",
  },
  "viduq3-pro": {
    unit: "second",
    symbol: "积分",
    rmbPerUnit: 0.03125,
    byResolution: { "1080p": 24, "720p": 20, "540p": 9 },
    note: "错峰（off_peak）半价，具体以平台控制台为准",
  },
  "wan2.7-t2v": {
    unit: "second",
    symbol: "¥",
    rmbPerUnit: 1,
    byResolution: { "720P": 0.6, "1080P": 1.0 },
    note: "人民币按秒计费",
  },
};

export function pricingFor(modelId: string): ModelPricing | undefined {
  return PRICING[modelId];
}

/** 指定分辨率下的单价；未收录返回 null */
export function unitPriceFor(model: ModelSpec, resolution?: string): number | null {
  const pricing = pricingFor(model.id);
  if (!pricing) return null;
  if (pricing.flat != null) return pricing.flat;
  if (!pricing.byResolution) return null;
  const key = resolution && pricing.byResolution[resolution] != null ? resolution : null;
  if (!key) return null;
  return pricing.byResolution[key];
}

function trimNumber(value: number): string {
  const fixed =
    value >= 1 ? value.toFixed(2) : value >= 0.01 ? value.toFixed(3) : value.toFixed(4);
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
}

/** 所有参考金额统一显示为人民币。 */
function formatRmb(value: number): string {
  return `¥${trimNumber(value)}`;
}

export function priceUnitLabel(pricing: ModelPricing): string {
  return pricing.unit === "second" ? "秒" : "张";
}

/** 模型胶囊上的单价标签，如「$0.08/秒」 */
export function priceTag(model: ModelSpec, resolution?: string): string | null {
  const pricing = pricingFor(model.id);
  const unit = unitPriceFor(model, resolution);
  if (!pricing || unit == null) return null;
  return `${formatRmb(unit * pricing.rmbPerUnit)}/${priceUnitLabel(pricing)}`;
}

/** 该模型所有已收录档位的价格，用于悬停说明 */
export function priceTable(model: ModelSpec): string[] {
  const pricing = pricingFor(model.id);
  if (!pricing) return [];
  const unit = priceUnitLabel(pricing);
  if (pricing.flat != null) {
    return [`${formatRmb(pricing.flat * pricing.rmbPerUnit)}/${unit}`];
  }
  return Object.entries(pricing.byResolution ?? {}).map(
    ([key, value]) => `${key} ${formatRmb(value * pricing.rmbPerUnit)}/${unit}`,
  );
}

export interface CostEstimate {
  /** 是否算得出金额（没有收录价格时为 false） */
  priced: boolean;
  /** 简短金额，统一人民币显示 */
  text: string;
  /** 明细，如「$0.08/秒 × 5 秒 × 1 条」 */
  detail: string;
  /** 换算与出处的补充说明 */
  note?: string;
}

/**
 * 估算本次提交的花费。价格缺失时返回 priced=false，界面提示去控制台确认。
 */
export function estimateCost(
  model: ModelSpec,
  options: { resolution?: string; duration?: number; count: number },
): CostEstimate {
  const pricing = pricingFor(model.id);
  const count = Math.max(1, options.count || 1);

  if (!pricing) {
    return {
      priced: false,
      text: "见控制台",
      detail: "该模型的价格尚未收录，请以平台控制台为准",
    };
  }

  const unit = unitPriceFor(model, options.resolution);
  if (unit == null) {
    return {
      priced: false,
      text: "见控制台",
      detail: options.resolution
        ? `${options.resolution} 档的价格尚未收录，请以平台控制台为准`
        : "该档位价格尚未收录，请以平台控制台为准",
      note: pricing.note,
    };
  }

  const quantity =
    pricing.unit === "second" ? (options.duration ?? 0) * count : count;
  const amount = unit * quantity;
  const unitLabel = priceUnitLabel(pricing);
  const detail =
    pricing.unit === "second"
      ? `${formatRmb(unit * pricing.rmbPerUnit)}/${unitLabel} × ${options.duration ?? 0} 秒 × ${count} 条`
      : `${formatRmb(unit * pricing.rmbPerUnit)}/${unitLabel} × ${count} 张`;

  return {
    priced: true,
    text: formatRmb(amount * pricing.rmbPerUnit),
    detail,
    note: pricing.note,
  };
}
