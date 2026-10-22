import { dataUri, rawRequest, trimBase } from "./http";
import {
  ProviderError,
  type AdapterContext,
  type ProviderAdapter,
  type TaskStatus,
  type VideoSubmitRequest,
} from "./types";

/**
 * 生数科技 Vidu。
 * 认证：Authorization: Token <api_key>（注意前缀是 Token，不是 Bearer）
 * 结果 URL 在 creations[0].url，任务状态字段是 state。
 */

interface ViduError {
  code?: number | string;
  reason?: string;
  message?: string;
}

function authHeaders(ctx: AdapterContext) {
  return {
    "Content-Type": "application/json",
    Authorization: `Token ${ctx.apiKey}`,
  };
}

async function call<T>(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {},
  timeoutMs = 60_000,
): Promise<T> {
  const res = await rawRequest<T & ViduError>(`${trimBase(ctx.apiBase)}${path}`, {
    ...init,
    headers: { ...authHeaders(ctx), ...(init.headers ?? {}) },
  }, timeoutMs);

  if (!res.ok) {
    const body = res.json as ViduError | null;
    throw new ProviderError(
      body?.message || body?.reason || `Vidu 接口错误 (HTTP ${res.status})`,
      String(body?.reason || res.status),
      res.status,
    );
  }
  return res.json as T;
}

const STATE_MAP: Record<string, TaskStatus["status"]> = {
  created: "queued",
  queueing: "queued",
  processing: "running",
  success: "succeeded",
  failed: "failed",
  canceled: "cancelled",
  cancelled: "cancelled",
};

export const viduAdapter: ProviderAdapter = {
  id: "vidu",
  label: "生数科技 Vidu",
  supportsVideo: true,
  supportsImage: false,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest): Promise<{ taskId: string }> {
    const payload: Record<string, unknown> = {
      model: req.model,
      prompt: req.prompt,
      duration: req.duration ?? 5,
      ...(req.seed != null ? { seed: req.seed } : {}),
    };
    if (req.resolution) payload.resolution = req.resolution.replace("P", "p");
    // Vidu 的 audio 控制音画直出（含台词与音效）
    if (req.audio !== undefined) payload.audio = req.audio;

    let path = "/ent/v2/text2video";
    if (req.firstFrame && req.lastFrame) {
      path = "/ent/v2/start-end2video";
      payload.images = [dataUri(req.firstFrame), dataUri(req.lastFrame)];
    } else if (req.firstFrame) {
      path = "/ent/v2/img2video";
      payload.images = [dataUri(req.firstFrame)];
    } else {
      payload.aspect_ratio = req.ratio || "16:9";
    }

    const data = await call<{ task_id?: string }>(ctx, path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!data?.task_id) throw new ProviderError("Vidu 未返回 task_id", "empty", 200);
    return { taskId: data.task_id };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    const data = await call<{
      state?: string;
      err_code?: string;
      credits?: number;
      creations?: { url?: string; cover_url?: string }[];
    }>(ctx, `/ent/v2/tasks/${encodeURIComponent(taskId)}/creations`, { method: "GET" }, 30_000);

    const status = STATE_MAP[String(data.state)] ?? "running";
    const url = data.creations?.[0]?.url;

    return {
      status,
      url: status === "succeeded" ? url : undefined,
      usage: data.credits != null ? { credits: data.credits } : undefined,
      error:
        status === "failed"
          ? {
              code: String(data.err_code || "failed"),
              message: viduMessage(String(data.err_code || "")),
            }
          : undefined,
    };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const res = await rawRequest<{
        remains?: { credit_remain?: number }[];
        remaining_credits?: { credit_remain?: number }[];
      }>(`${trimBase(ctx.apiBase)}/ent/v2/credits`, { headers: authHeaders(ctx) }, 20_000);

      if (res.status === 401) {
        return { ok: false, message: "Token 无效（Vidu 返回 401 未鉴权）" };
      }
      if (res.status === 403) {
        return { ok: false, message: "Key 无权限（Vidu 返回 403）" };
      }
      if (!res.ok) {
        return { ok: false, message: `Vidu 返回 HTTP ${res.status}` };
      }
      const list = res.json?.remains ?? res.json?.remaining_credits ?? [];
      const credits = list.reduce((sum, item) => sum + Number(item.credit_remain ?? 0), 0);
      return { ok: true, message: `连接正常，Key 有效（剩余积分 ${credits}）` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? `测试失败：${error.message}` : "测试失败",
      };
    }
  },
};

function viduMessage(code: string): string {
  const map: Record<string, string> = {
    CreditInsufficient: "Vidu 积分不足，请充值",
    TaskPromptPolicyViolation: "提示词未通过内容审核",
    AuditSubmitIllegal: "输入未通过安全审核",
    CreationPolicyViolation: "生成结果未通过风控",
    PhotoAuditNotPass: "参考图未通过审核",
    ImageDownloadFailure: "Vidu 无法下载参考图（内网图片需要可公网访问）",
    ImageFormatInvalid: "参考图格式不支持",
    ImageSizeInvalid: "参考图尺寸不符合要求",
    ModelUnavailable: "该模型当前不可用",
    QuotaExceeded: "超出并发限制，请稍后再试",
    TooManyRequests: "请求过于频繁，请稍后再试",
    SystemThrottling: "服务繁忙，请稍后再试",
    Unauthorized: "鉴权失败，请检查 Key",
    Forbidden: "无权限调用该模型",
    TaskNotFound: "任务不存在或已过期",
    InternalServiceFailure: "Vidu 服务内部错误",
  };
  return map[code] || (code ? `Vidu 任务失败（${code}）` : "Vidu 任务失败");
}