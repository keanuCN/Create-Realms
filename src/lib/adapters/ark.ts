import { bearer, dataUri, rawRequest, trimBase } from "./http";
import {
  ProviderError,
  type AdapterContext,
  type ImageSubmitRequest,
  type ImageSubmitResult,
  type ProviderAdapter,
  type TaskStatus,
  type VideoSubmitRequest,
} from "./types";

/**
 * 字节跳动 火山方舟（Seedance 视频 / Seedream 图片）。
 * 认证：Authorization: Bearer $ARK_API_KEY
 * 视频是异步任务（创建 → 轮询），图片同步返回。
 */

type ContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string }; role?: "first_frame" | "last_frame" };

interface ArkError {
  code?: string;
  message?: string;
  param?: string;
  type?: string;
}

async function call<T>(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {},
  timeoutMs = 120_000,
): Promise<T> {
  const res = await rawRequest<T & { error?: ArkError }>(
    `${trimBase(ctx.apiBase)}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...bearer(ctx.apiKey),
        ...(init.headers ?? {}),
      },
    },
    timeoutMs,
  );

  if (!res.ok) {
    const error = (res.json as { error?: ArkError } | null)?.error;
    throw new ProviderError(
      error?.message || error?.code || `方舟接口错误 (HTTP ${res.status})`,
      error?.code || String(res.status),
      res.status,
    );
  }
  return res.json as T;
}

const STATUS_MAP: Record<string, TaskStatus["status"]> = {
  queued: "queued",
  running: "running",
  cancelled: "cancelled",
  succeeded: "succeeded",
  failed: "failed",
  expired: "failed",
};

const TIER_PX: Record<string, number> = {
  "1K": 1024,
  "1.5K": 1536,
  "2K": 2048,
  "3K": 3072,
  "4K": 4096,
};

/** Seedream 的 size 需要「总像素」落在平台区间内，这里按面积反推宽高。 */
function sizeForRatio(ratio: string, tier: string): string {
  const MIN_AREA = 921_600;
  const MAX_AREA = 4_624_220;
  const [w, h] = (ratio || "1:1").split(":").map(Number);
  const ratioW = Number.isFinite(w) && w > 0 ? w : 1;
  const ratioH = Number.isFinite(h) && h > 0 ? h : 1;

  let area = (TIER_PX[tier] ?? 2048) ** 2;
  area = Math.min(Math.max(area, MIN_AREA), MAX_AREA);

  const width = Math.sqrt((area * ratioW) / ratioH);
  const height = Math.sqrt((area * ratioH) / ratioW);
  const round8 = (value: number) => Math.max(512, Math.round(value / 8) * 8);
  return `${round8(width)}x${round8(height)}`;
}

export const arkAdapter: ProviderAdapter = {
  id: "volcengine-ark",
  label: "即梦 / 豆包（火山方舟）",
  supportsVideo: true,
  supportsImage: true,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest): Promise<{ taskId: string }> {
    const content: ContentItem[] = [{ type: "text", text: req.prompt }];

    if (req.firstFrame) {
      content.push({
        type: "image_url",
        image_url: { url: dataUri(req.firstFrame) },
        role: "first_frame",
      });
    }
    if (req.lastFrame) {
      content.push({
        type: "image_url",
        image_url: { url: dataUri(req.lastFrame) },
        role: "last_frame",
      });
    }

    const body: Record<string, unknown> = {
      model: req.model,
      content,
      duration: req.duration ?? 5,
      watermark: false,
    };
    if (req.resolution) body.resolution = req.resolution.replace("P", "p");
    // 首尾帧场景由输入图决定比例，不能传 ratio
    if (!req.firstFrame && !req.lastFrame) body.ratio = req.ratio || "16:9";
    if (req.seed != null && req.seed >= 0) body.seed = req.seed;

    const data = await call<{ id?: string }>(ctx, "/contents/generations/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!data?.id) throw new ProviderError("方舟未返回任务 id", "empty", 200);
    return { taskId: data.id };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    const data = await call<{
      id?: string;
      status?: string;
      content?: { video_url?: string; last_frame_url?: string };
      error?: ArkError;
      resolution?: string;
      duration?: number;
      ratio?: string;
      usage?: { total_tokens?: number; completion_tokens?: number };
    }>(
      ctx,
      `/contents/generations/tasks/${encodeURIComponent(taskId)}`,
      { method: "GET" },
      30_000,
    );

    const status = STATUS_MAP[String(data.status)] ?? "running";
    return {
      status,
      url: status === "succeeded" ? data.content?.video_url : undefined,
      error:
        status === "failed"
          ? {
              code: data.error?.code || String(data.status),
              message: data.error?.message || "方舟任务失败",
            }
          : undefined,
      resolution: data.resolution,
      duration: data.duration,
      ratio: data.ratio,
      usage: data.usage as Record<string, unknown> | undefined,
    };
  },

  async submitImage(ctx, req: ImageSubmitRequest): Promise<ImageSubmitResult> {
    const count = Math.max(1, Math.min(req.n ?? 1, 4));
    const size = sizeForRatio(req.ratio || "1:1", req.resolution || "2K");
    const urls: string[] = [];

    // Seedream 每次请求返回一组图；这里按需要并发多次拿多张。
    const requests = Array.from({ length: count }, (_, index) =>
      call<{ data?: { url?: string }[] }>(
        ctx,
        "/images/generations",
        {
          method: "POST",
          body: JSON.stringify({
            model: req.model,
            prompt: req.prompt,
            size,
            output_format: "jpeg",
            watermark: false,
            ...(req.seed != null ? { seed: req.seed + index } : {}),
            ...(req.referenceImage ? { image: dataUri(req.referenceImage) } : {}),
          }),
        },
        180_000,
      ),
    );

    const settled = await Promise.allSettled(requests);
    let failed = 0;
    for (const item of settled) {
      if (item.status === "fulfilled") {
        const url = item.value.data?.[0]?.url;
        if (url) urls.push(url);
        else failed += 1;
      } else {
        failed += 1;
      }
    }

    if (!urls.length) {
      const first = settled.find((item) => item.status === "rejected");
      if (first && first.status === "rejected") throw first.reason;
      throw new ProviderError("方舟图片生成失败", "empty", 200);
    }

    return { urls, failedCount: failed };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const res = await rawRequest(
        `${trimBase(ctx.apiBase)}/contents/generations/tasks?page_size=1`,
        { headers: bearer(ctx.apiKey) },
        20_000,
      );
      if (res.status === 401) {
        return { ok: false, message: "API Key 无效（方舟返回 401 鉴权失败）" };
      }
      if (res.status === 403) {
        return { ok: false, message: "账号欠费或被限制（方舟返回 403）" };
      }
      if (res.status === 429) {
        return { ok: false, message: "触发限流（该接口 QPS 上限为 1，稍后再试）" };
      }
      if (!res.ok) {
        return { ok: false, message: `方舟返回 HTTP ${res.status}` };
      }
      return { ok: true, message: "连接正常，Key 有效" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? `测试失败：${error.message}` : "测试失败",
      };
    }
  },
};