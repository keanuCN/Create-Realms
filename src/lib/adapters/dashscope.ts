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
 * 阿里云百炼 · 通义万相 / HappyHorse。
 * 认证：Authorization: Bearer sk-xxx
 * 视频是异步任务，创建时必须带 X-DashScope-Async: enable。
 */

interface DashError {
  code?: string;
  message?: string;
  request_id?: string;
}

function asyncHeaders(ctx: AdapterContext) {
  return {
    "Content-Type": "application/json",
    "X-DashScope-Async": "enable",
    ...bearer(ctx.apiKey),
  };
}

async function call<T>(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {},
  timeoutMs = 60_000,
): Promise<T> {
  const res = await rawRequest<T & DashError>(`${trimBase(ctx.apiBase)}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...bearer(ctx.apiKey), ...(init.headers ?? {}) },
  }, timeoutMs);

  if (!res.ok) {
    const body = res.json as DashError | null;
    throw new ProviderError(
      body?.message || body?.code || `百炼接口错误 (HTTP ${res.status})`,
      body?.code || String(res.status),
      res.status,
      body?.request_id,
    );
  }
  return res.json as T;
}

const STATUS_MAP: Record<string, TaskStatus["status"]> = {
  PENDING: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "cancelled",
  CANCELLED: "cancelled",
  UNKNOWN: "failed",
};

const IMAGE_SIZES: Record<string, string> = {
  "1:1": "1280*1280",
  "4:3": "1472*1104",
  "3:4": "1104*1472",
  "16:9": "1696*960",
  "9:16": "960*1696",
};

export const dashscopeAdapter: ProviderAdapter = {
  id: "dashscope",
  label: "通义万相 / HappyHorse",
  supportsVideo: true,
  supportsImage: true,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest): Promise<{ taskId: string }> {
    const input: Record<string, unknown> = { prompt: req.prompt };
    const parameters: Record<string, unknown> = {
      duration: req.duration ?? 5,
      watermark: false,
    };
    if (req.resolution) parameters.resolution = req.resolution.replace("p", "P");
    if (req.promptOptimizer !== undefined) parameters.prompt_extend = req.promptOptimizer;
    if (req.audio !== undefined) parameters.audio = req.audio;

    if (req.firstFrame || req.lastFrame) {
      const media: { type: string; url: string }[] = [];
      if (req.firstFrame) media.push({ type: "first_frame", url: dataUri(req.firstFrame) });
      if (req.lastFrame) media.push({ type: "last_frame", url: dataUri(req.lastFrame) });
      input.media = media;
    } else {
      parameters.ratio = req.ratio || "16:9";
    }
    if (req.seed != null) parameters.seed = req.seed;

    const data = await call<{ output?: { task_id?: string; task_status?: string } }>(
      ctx,
      "/services/aigc/video-generation/video-synthesis",
      {
        method: "POST",
        headers: asyncHeaders(ctx),
        body: JSON.stringify({ model: req.model, input, parameters }),
      },
      120_000,
    );

    const taskId = data?.output?.task_id;
    if (!taskId) throw new ProviderError("百炼未返回 task_id", "empty", 200);
    return { taskId };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    const data = await call<{
      output?: {
        task_id?: string;
        task_status?: string;
        video_url?: string;
        code?: string;
        message?: string;
      };
      usage?: { duration?: number; SR?: number; ratio?: string };
    }>(ctx, `/tasks/${encodeURIComponent(taskId)}`, { method: "GET" }, 30_000);

    const raw = String(data.output?.task_status ?? "RUNNING");
    const status = STATUS_MAP[raw] ?? "running";
    const failed = status === "failed";

    return {
      status,
      url: status === "succeeded" ? data.output?.video_url : undefined,
      error: failed
        ? {
            code: data.output?.code || raw,
            message:
              raw === "UNKNOWN"
                ? "任务不存在或已过期（结果只保留 24 小时）"
                : data.output?.message || "百炼任务失败",
          }
        : undefined,
      resolution: data.usage?.SR ? `${data.usage.SR}P` : undefined,
      duration: data.usage?.duration,
      ratio: data.usage?.ratio,
    };
  },

  async submitImage(ctx, req: ImageSubmitRequest): Promise<ImageSubmitResult> {
    const size = IMAGE_SIZES[req.ratio || "1:1"] ?? "1280*1280";
    const data = await call<{
      output?: {
        choices?: { message?: { content?: { image?: string }[] } }[];
        code?: string;
        message?: string;
      };
    }>(
      ctx,
      "/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        body: JSON.stringify({
          model: req.model,
          input: {
            messages: [
              {
                role: "user",
                content: [
                  { text: req.prompt },
                  ...(req.referenceImage ? [{ image: dataUri(req.referenceImage) }] : []),
                ],
              },
            ],
          },
          parameters: {
            size,
            n: Math.max(1, Math.min(req.n ?? 1, 4)),
            watermark: false,
            prompt_extend: req.promptOptimizer ?? true,
          },
        }),
      },
      180_000,
    );

    if (data.output?.code) {
      throw new ProviderError(data.output.message || "图片生成失败", data.output.code, 200);
    }

    const urls =
      data.output?.choices
        ?.flatMap((choice) => choice.message?.content ?? [])
        .map((item) => item.image)
        .filter((url): url is string => Boolean(url)) ?? [];

    if (!urls.length) {
      throw new ProviderError("百炼图片生成没有返回结果", "empty", 200);
    }
    return { urls };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const res = await rawRequest<{ output?: { task_status?: string }; code?: string; message?: string }>(
        `${trimBase(ctx.apiBase)}/tasks/00000000-0000-0000-0000-000000000000`,
        { headers: bearer(ctx.apiKey) },
        20_000,
      );

      if (res.status === 401) {
        return { ok: false, message: "API Key 无效（百炼返回 401）" };
      }
      if (res.status === 403) {
        return { ok: false, message: "账号权限或免费额度问题（百炼返回 403）" };
      }
      if (!res.ok) {
        return { ok: false, message: res.json?.message || `百炼返回 HTTP ${res.status}` };
      }
      // Key 有效时查询不存在的任务会返回 200 + UNKNOWN
      return { ok: true, message: "连接正常，Key 有效" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? `测试失败：${error.message}` : "测试失败",
      };
    }
  },
};