import { randomUUID } from "node:crypto";
import { env } from "../env";
import { errorCodeFromStatus } from "../errors";
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

interface ApiErrorBody {
  type?: string;
  error?: { type?: string; message?: string; http_code?: string };
  request_id?: string;
}

function extractCode(body: ApiErrorBody | null, status: number): string {
  const message = body?.error?.message ?? "";
  const paren = message.match(/\((\d{4})\)\s*$/);
  if (paren) return paren[1];
  const type = body?.error?.type ?? body?.type ?? "";
  if (type === "authorized_error") return "1004";
  if (type === "insufficient_balance_error") return "1008";
  if (type === "rate_limit_error") return "1002";
  if (type === "unprocessable_entity_error") return "1026";
  return errorCodeFromStatus(status);
}

async function call<T>(
  ctx: AdapterContext,
  path: string,
  init: RequestInit,
  timeoutMs = 120_000,
): Promise<T> {
  const res = await rawRequest<T>(`${trimBase(ctx.apiBase)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...bearer(ctx.apiKey),
      ...(init.headers ?? {}),
    },
  }, timeoutMs);

  if (!res.ok) {
    const errBody = res.json as ApiErrorBody | null;
    throw new ProviderError(
      errBody?.error?.message || `MiniMax 接口错误 (HTTP ${res.status})`,
      extractCode(errBody, res.status),
      res.status,
      errBody?.request_id,
    );
  }
  return res.json as T;
}

interface ContentItem {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
  role?: "first_frame" | "last_frame" | "reference_image";
}

interface RawVideoTask {
  id: string;
  status: TaskStatus["status"];
  content?: { url?: string; prompt?: string } | null;
  error?: { code?: string; message?: string };
  resolution?: string;
  duration?: number;
  ratio?: string;
  usage?: Record<string, unknown>;
  output?: { url?: string } | null;
  video_url?: string;
}

const mockTasks = new Map<string, { createdAt: number; mode: string }>();

export const minimaxAdapter: ProviderAdapter = {
  id: "minimax",
  label: "MiniMax 海螺",
  supportsVideo: true,
  supportsImage: true,
  frameInput: "base64",

  async submitVideo(ctx, req): Promise<{ taskId: string }> {
    if (env.minimax.mock) {
      const id = `mock-${randomUUID()}`;
      mockTasks.set(id, { createdAt: Date.now(), mode: req.model });
      return { taskId: id };
    }

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

    const hasFrames = Boolean(req.firstFrame || req.lastFrame);
    const references = hasFrames ? [] : (req.referenceImages ?? []);
    for (const reference of references) {
      content.push({
        type: "image_url",
        image_url: { url: dataUri(reference) },
        role: "reference_image",
      });
    }

    const body: Record<string, unknown> = {
      model: req.model,
      content,
      resolution: req.resolution || "768P",
      duration: req.duration || 5,
    };
    // 文生视频必须显式给比例；图生 / 参考生视频由输入图决定
    if (!hasFrames && !references.length) body.ratio = req.ratio || "16:9";

    if (req.model === "MiniMax-H3-Max") {
      const mode =
        req.promptOptimizer === false
          ? "disabled"
          : (req.promptExpansion ?? "balanced");
      body.extra = { prompt_expansion_mode: mode };
    }

    const data = await call<{ task_id?: string }>(ctx, "/v2/video_generation", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!data?.task_id) {
      throw new ProviderError("创建任务失败：接口未返回 task_id", "500", 500);
    }
    return { taskId: data.task_id };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    if (env.minimax.mock) {
      const task = mockTasks.get(taskId);
      const age = task ? Date.now() - task.createdAt : 60_000;
      if (age < 7000) return { status: "running" };
      return {
        status: "succeeded",
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        resolution: "768P",
        duration: 5,
        ratio: "16:9",
        usage: { total_seconds: 5, output_seconds: 5, input_image_count: 0 },
      };
    }

    const data = await call<{ task?: RawVideoTask }>(
      ctx,
      `/v2/query/video_generation/${encodeURIComponent(taskId)}`,
      { method: "GET" },
      30_000,
    );
    const task = data?.task;
    if (!task) {
      throw new ProviderError("查询任务失败：接口未返回任务信息", "500", 500);
    }

    return {
      status: task.status,
      // V2 返回结构：结果在 task.content.url
      url: task.content?.url ?? task.output?.url ?? task.video_url ?? undefined,
      error: task.error,
      resolution: task.resolution,
      duration: task.duration,
      ratio: task.ratio,
      usage: task.usage,
    };
  },

  async submitImage(ctx, req: ImageSubmitRequest): Promise<ImageSubmitResult> {
    if (env.minimax.mock) {
      const count = Math.max(1, Math.min(req.n ?? 1, 4));
      return {
        urls: Array.from({ length: count }, (_, index) =>
          mockImageDataUri(req.prompt, req.ratio || "1:1", index),
        ),
        failedCount: 0,
      };
    }

    const data = await call<{
      data?: { image_urls?: string[] };
      metadata?: { success_count?: number; failed_count?: number };
      base_resp?: { status_code?: number; status_msg?: string };
    }>(
      ctx,
      "/v1/image_generation",
      {
        method: "POST",
        body: JSON.stringify({
          model: req.model,
          prompt: req.prompt,
          aspect_ratio: req.ratio || "1:1",
          response_format: "url",
          n: req.n ?? 1,
          prompt_optimizer: req.promptOptimizer ?? true,
          ...(req.seed != null ? { seed: req.seed } : {}),
        }),
      },
      180_000,
    );

    const statusCode = Number(data?.base_resp?.status_code ?? 0);
    if (statusCode !== 0) {
      throw new ProviderError(
        data?.base_resp?.status_msg || "图片生成失败",
        String(statusCode),
        200,
      );
    }

    return {
      urls: data?.data?.image_urls ?? [],
      failedCount: Number(data?.metadata?.failed_count ?? 0),
    };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const res = await rawRequest(
        `${trimBase(ctx.apiBase)}/v2/query/video_generation/000000000000000`,
        { headers: bearer(ctx.apiKey) },
        20_000,
      );
      if (res.status === 401 || /"(1004|2049)"/.test(res.text)) {
        return { ok: false, message: "Key 无效或已失效（鉴权失败）" };
      }
      if (res.status >= 500) {
        return { ok: false, message: `服务端异常（HTTP ${res.status}），请稍后再试` };
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

function ratioSize(ratio: string): [number, number] {
  const map: Record<string, [number, number]> = {
    "1:1": [1024, 1024],
    "16:9": [1280, 720],
    "4:3": [1152, 864],
    "3:2": [1248, 832],
    "2:3": [832, 1248],
    "3:4": [864, 1152],
    "9:16": [720, 1280],
    "21:9": [1344, 576],
  };
  return map[ratio] ?? [1024, 1024];
}

function mockImageDataUri(prompt: string, ratio: string, seed: number) {
  const [width, height] = ratioSize(ratio);
  const hue = (seed * 47 + 210) % 360;
  const safe = prompt
    .slice(0, 120)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},70%,52%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 70) % 360},75%,32%)"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <text x="50%" y="46%" fill="rgba(255,255,255,.92)" font-family="system-ui,sans-serif" font-size="${Math.round(
    Math.min(width, height) / 18,
  )}" text-anchor="middle">MOCK · ${ratio}</text>
  <text x="50%" y="56%" fill="rgba(255,255,255,.7)" font-family="system-ui,sans-serif" font-size="${Math.round(
    Math.min(width, height) / 34,
  )}" text-anchor="middle">${safe}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}