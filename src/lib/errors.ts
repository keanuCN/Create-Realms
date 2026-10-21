const MESSAGES: Record<string, string> = {
  "1002": "请求过于频繁，已被限流，请稍后再试。",
  "1004": "API Key 无效或鉴权失败，请到平台控制台检查密钥。",
  "1008": "账户余额不足，请到 MiniMax 控制台充值。",
  "1026": "提示词或参考素材包含敏感内容，已被拦截，请调整后重试。",
  "1027": "生成结果未通过内容审核。",
  "2013": "参数不合法：请检查分辨率、时长、比例或提示词长度。",
  "2049": "API Key 无效，请检查 .env 中的 MINIMAX_API_KEY。",
  "rate_limit": "请求过于频繁，请稍后再试。",
  "overloaded": "服务繁忙，请稍后重试。",
};

export function friendlyError(code?: string | null, fallback?: string | null) {
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (fallback && fallback.trim()) return fallback.trim();
  return "生成失败，请稍后重试。";
}

export function errorCodeFromStatus(status: number): string {
  switch (status) {
    case 401:
      return "1004";
    case 402:
      return "1008";
    case 429:
      return "1002";
    case 422:
      return "1026";
    default:
      return String(status);
  }
}
