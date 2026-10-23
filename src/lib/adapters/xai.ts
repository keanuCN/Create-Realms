import { bearer, dataUri, rawRequest, trimBase } from "./http";
import {
  ProviderError,
  type AdapterContext,
  type ProviderAdapter,
  type TaskStatus,
  type VideoSubmitRequest,
} from "./types";

interface XaiError {
  error?: { message?: string; code?: string } | string;
  message?: string;
}

interface XaiVideoResult extends XaiError {
  status?: string;
  request_id?: string;
  video?: { url?: string; duration?: number };
}

interface TaskMetadata {
  requestId: string;
  duration?: number;
  resolution?: string;
  ratio?: string;
}

function endpoint(ctx: AdapterContext, path: string) {
  const base = trimBase(ctx.apiBase);
  const versioned = /\/v1$/i.test(base) ? base : `${base}/v1`;
  return `${versioned}${path}`;
}

function errorMessage(body: XaiError | null, fallback: string) {
  if (typeof body?.error === "string") return body.error;
  return body?.error?.message || body?.message || fallback;
}

function packTask(requestId: string, req: VideoSubmitRequest) {
  return JSON.stringify({
    requestId,
    duration: req.duration ?? 8,
    resolution: req.resolution ?? "720p",
    ratio: req.ratio ?? "16:9",
  } satisfies TaskMetadata);
}

function unpackTask(taskId: string): TaskMetadata {
  try {
    const parsed = JSON.parse(taskId) as Partial<TaskMetadata>;
    if (typeof parsed.requestId === "string") {
      return {
        requestId: parsed.requestId,
        duration: typeof parsed.duration === "number" ? parsed.duration : undefined,
        resolution: typeof parsed.resolution === "string" ? parsed.resolution : undefined,
        ratio: typeof parsed.ratio === "string" ? parsed.ratio : undefined,
      };
    }
  } catch {
    // Older task records may store the raw xAI request ID.
  }
  return { requestId: taskId };
}

async function call<T extends XaiError>(
  ctx: AdapterContext,
  url: string,
  init: RequestInit = {},
  timeoutMs = 60_000,
) {
  const response = await rawRequest<T>(url, {
    ...init,
    headers: {
      ...bearer(ctx.apiKey),
      ...(init.headers ?? {}),
    },
  }, timeoutMs);

  if (!response.ok) {
    throw new ProviderError(
      errorMessage(response.json, `xAI 接口错误 (HTTP ${response.status})`),
      response.status === 429
        ? "429"
        : response.json?.error && typeof response.json.error === "object"
          ? response.json.error.code || String(response.status)
          : String(response.status),
      response.status,
    );
  }
  if (!response.json) throw new ProviderError("xAI 返回了无法解析的响应", "invalid_response", 502);
  return response.json;
}

export const xaiAdapter: ProviderAdapter = {
  id: "xai",
  label: "xAI Grok Imagine",
  supportsVideo: true,
  supportsImage: false,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest) {
    if (req.referenceImages?.length && req.resolution === "1080p") {
      throw new ProviderError("Grok Imagine 使用参考图时最高支持 720p，请调低分辨率后重试", "unsupported_resolution", 400);
    }

    const payload: Record<string, unknown> = {
      model: req.model,
      prompt: req.prompt,
      duration: req.duration ?? 8,
      aspect_ratio: req.ratio || "16:9",
      resolution: req.resolution || "720p",
      ...(req.audio !== undefined ? { generate_audio: req.audio } : {}),
    };
    if (req.firstFrame) payload.image = { url: dataUri(req.firstFrame) };
    if (req.lastFrame) payload.last_frame = { url: dataUri(req.lastFrame) };
    if (req.referenceImages?.length) {
      payload.reference_images = req.referenceImages.map((image) => ({ url: dataUri(image) }));
    }

    const result = await call<XaiVideoResult>(
      ctx,
      endpoint(ctx, "/videos/generations"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      120_000,
    );

    if (!result?.request_id) {
      throw new ProviderError(errorMessage(result, "xAI 未返回视频任务 ID"), "empty", 200);
    }
    return { taskId: packTask(result.request_id, req) };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    const metadata = unpackTask(taskId);
    const result = await call<XaiVideoResult>(
      ctx,
      endpoint(ctx, `/videos/${encodeURIComponent(metadata.requestId)}`),
      { method: "GET" },
      30_000,
    );

    const raw = String(result?.status || "pending").toLowerCase();
    if (raw === "pending" || raw === "queued") return { status: "queued" };
    if (raw === "failed" || raw === "expired") {
      return {
        status: "failed",
        error: {
          code: raw,
          message: errorMessage(result, raw === "expired" ? "xAI 视频任务已过期" : "xAI 视频生成失败"),
        },
      };
    }
    if (raw !== "done" && raw !== "succeeded" && raw !== "completed") {
      return { status: "running" };
    }
    if (!result?.video?.url) {
      return {
        status: "failed",
        error: { code: "no_output", message: "xAI 任务已完成，但没有返回视频地址" },
      };
    }

    return {
      status: "succeeded",
      url: result.video.url,
      duration: result.video.duration ?? metadata.duration,
      resolution: metadata.resolution,
      ratio: metadata.ratio,
    };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      await call<{ data?: unknown[] } & XaiError>(ctx, endpoint(ctx, "/models"), {}, 20_000);
      return { ok: true, message: "连接正常，Key 有效" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? `测试失败：${error.message}` : "测试失败",
      };
    }
  },
};
