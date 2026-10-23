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
  if (fallback && /project has been denied access/i.test(fallback)) {
    return "Google 已拒绝当前项目访问 Gemini API（403 权限错误），本次未能生成。请在 Google AI Studio 核对 API Key 对应的项目及项目状态；如果项目显示 Restricted、Unavailable，或已完成计费设置仍报此错，请联系 Google AI 支持并提供此 403 错误。查看项目与配额：https://aistudio.google.com/";
  }
  if (
    fallback &&
    ((/limit:\s*0/i.test(fallback) && /free\s*tier/i.test(fallback)) ||
      /免费层.*(每日限额为\s*0|调用额度)/.test(fallback)) &&
    /gemini|google/i.test(fallback)
  ) {
    return "图片未生成：当前 Google API Key 所属项目的免费层没有该 Gemini 图片模型的调用额度（每日限额为 0）。请管理员在 Google AI Studio 为这个项目启用计费并确认付费层已生效后重试；也可以切换到其他已配置的图片模型。查看项目限额：https://ai.dev/rate-limit";
  }
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
