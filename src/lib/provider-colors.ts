export interface ProviderColor {
  /** 主渐变起止色 */
  from: string;
  to: string;
  /** 低透明度底色（用于激活态背景） */
  soft: string;
}

export const PROVIDER_COLORS: Record<string, ProviderColor> = {
  minimax: { from: "#8b7dff", to: "#6a56f5", soft: "rgba(139,125,255,0.16)" },
  "volcengine-ark": { from: "#4d9bff", to: "#2f6bff", soft: "rgba(77,155,255,0.16)" },
  kling: { from: "#4de2c0", to: "#16b39a", soft: "rgba(77,226,192,0.16)" },
  pixverse: { from: "#ff7ac6", to: "#e8559f", soft: "rgba(255,122,198,0.16)" },
  vidu: { from: "#ffb347", to: "#f5860f", soft: "rgba(255,179,71,0.16)" },
  dashscope: { from: "#ff6b6b", to: "#e0413f", soft: "rgba(255,107,107,0.16)" },
  openai: { from: "#10a37f", to: "#0b7a5f", soft: "rgba(16,163,127,0.16)" },
  google: { from: "#4285f4", to: "#2b6cd4", soft: "rgba(66,133,244,0.16)" },
  runway: { from: "#b06bff", to: "#8b3ff5", soft: "rgba(176,107,255,0.16)" },
};

const FALLBACK: ProviderColor = {
  from: "#8b7dff",
  to: "#6a56f5",
  soft: "rgba(139,125,255,0.16)",
};

export function providerColor(provider: string): ProviderColor {
  return PROVIDER_COLORS[provider] ?? FALLBACK;
}

export function providerGradient(provider: string, angle = "135deg"): string {
  const { from, to } = providerColor(provider);
  return `linear-gradient(${angle}, ${from}, ${to})`;
}