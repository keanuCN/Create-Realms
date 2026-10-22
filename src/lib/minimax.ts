import { randomUUID } from "node:crypto";
import { env } from "./env";
import { errorCodeFromStatus } from "./errors";
import { getProviderRuntime } from "./providers";

export class MinimaxError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(message: string, code: string, status: number, requestId?: string) {
    super(message);
    this.name = "MinimaxError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

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

async function apiFetch<T>(
  path: string,
  init: RequestInit,
  timeoutMs = 120_000,
): Promise<T> {
  const runtime = await getProviderRuntime("minimax");
  if (!runtime.apiKey) {
    throw new MinimaxError(
      "还没有配置 MiniMax API Key，请让管理员到「模型设置」页面填写",
      "no_key",
      503,
    );
  }
  if (!runtime.enabled) {
    throw new MinimaxError(
      "MiniMax 供应商已被管理员停用，请到「模型设置」中启用",
      "disabled",
      503,
    );
  }

  const res = await fetch(`${runtime.apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const errBody = body as ApiErrorBody | null;
    throw new MinimaxError(
      errBody?.error?.message || `MiniMax 接口错误 (HTTP ${res.status})`,
      extractCode(errBody, res.status),
      res.status,
      errBody?.request_id,
    );
  }
  return body as T;
}

/* -------------------------------------------------------------------------- */
/* Video                                                                      */
/* -------------------------------------------------------------------------- */

export type PromptExpansion = "disabled" | "balanced" | "quality";

export interface VideoRequest {
  model: string;
  prompt: string;
  resolution: string;
  duration: number;
  ratio?: string;
  firstFrame?: { data: Buffer; mime: string } | null;
  lastFrame?: { data: Buffer; mime: string } | null;
  promptExpansion?: PromptExpansion;
}

interface ContentItem {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
  role?: "first_frame" | "last_frame";
}

export interface VideoTaskState {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  url?: string;
  error?: { code?: string; message?: string };
  resolution?: string;
  duration?: number;
  ratio?: string;
  usage?: Record<string, unknown>;
}

interface RawVideoTask {
  id: string;
  status: VideoTaskState["status"];
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

export async function createVideoTask(req: VideoRequest): Promise<string> {
  if (env.minimax.mock) {
    const id = `mock-${randomUUID()}`;
    mockTasks.set(id, { createdAt: Date.now(), mode: req.model });
    return id;
  }

  const content: ContentItem[] = [{ type: "text", text: req.prompt }];
  if (req.firstFrame) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${req.firstFrame.mime};base64,${req.firstFrame.data.toString(
          "base64",
        )}`,
      },
      role: "first_frame",
    });
  }
  if (req.lastFrame) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${req.lastFrame.mime};base64,${req.lastFrame.data.toString(
          "base64",
        )}`,
      },
      role: "last_frame",
    });
  }

  const hasFrames = Boolean(req.firstFrame || req.lastFrame);
  const body: Record<string, unknown> = {
    model: req.model,
    content,
    resolution: req.resolution,
    duration: req.duration,
  };
  if (!hasFrames) {
    body.ratio = req.ratio || "16:9";
  }
  if (req.model === "MiniMax-H3-Max" && req.promptExpansion) {
    body.extra = { prompt_expansion_mode: req.promptExpansion };
  }

  const data = await apiFetch<{ task_id?: string }>("/v2/video_generation", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!data?.task_id) {
    throw new MinimaxError("创建任务失败：接口未返回 task_id", "500", 500);
  }
  return data.task_id;
}

export async function queryVideoTask(taskId: string): Promise<VideoTaskState> {
  if (env.minimax.mock) {
    const task = mockTasks.get(taskId);
    const age = task ? Date.now() - task.createdAt : 60_000;
    if (age < 7000) return { id: taskId, status: "running" };
    return {
      id: taskId,
      status: "succeeded",
      url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      resolution: "768P",
      duration: 5,
      ratio: "16:9",
      usage: { total_seconds: 5, output_seconds: 5, input_image_count: 0 },
    };
  }

  const data = await apiFetch<{ task?: RawVideoTask }>(
    `/v2/query/video_generation/${encodeURIComponent(taskId)}`,
    { method: "GET" },
    30_000,
  );
  const task = data?.task;
  if (!task) {
    throw new MinimaxError("查询任务失败：接口未返回任务信息", "500", 500);
  }

  // MiniMax returns the result inside `task.content.url` (V2 API).
  const url =
    task.content?.url ?? task.output?.url ?? task.video_url ?? undefined;

  return {
    id: task.id,
    status: task.status,
    url,
    error: task.error,
    resolution: task.resolution,
    duration: task.duration,
    ratio: task.ratio,
    usage: task.usage,
  };
}

/* -------------------------------------------------------------------------- */
/* Image                                                                      */
/* -------------------------------------------------------------------------- */

export interface ImageRequest {
  model: string;
  prompt: string;
  aspectRatio?: string;
  n?: number;
  seed?: number;
  promptOptimizer?: boolean;
}

export interface ImageResult {
  urls: string[];
  failedCount: number;
}

export async function generateImages(req: ImageRequest): Promise<ImageResult> {
  if (env.minimax.mock) {
    const count = Math.max(1, Math.min(req.n ?? 1, 4));
    return {
      urls: Array.from({ length: count }, (_, i) =>
        mockImageDataUri(req.prompt, req.aspectRatio || "1:1", i),
      ),
      failedCount: 0,
    };
  }

  const data = await apiFetch<{
    data?: { image_urls?: string[] };
    metadata?: { success_count?: number; failed_count?: number };
    base_resp?: { status_code?: number; status_msg?: string };
  }>(
    "/v1/image_generation",
    {
      method: "POST",
      body: JSON.stringify({
        model: req.model,
        prompt: req.prompt,
        aspect_ratio: req.aspectRatio || "1:1",
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
    throw new MinimaxError(
      data?.base_resp?.status_msg || "图片生成失败",
      String(statusCode),
      200,
    );
  }

  return {
    urls: data?.data?.image_urls ?? [],
    failedCount: Number(data?.metadata?.failed_count ?? 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Download                                                                   */
/* -------------------------------------------------------------------------- */

export async function downloadRemote(url: string): Promise<{
  data: Buffer;
  contentType: string;
}> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) throw new Error("无法解析 data URI");
    const [, mime = "application/octet-stream", isBase64, payload] = match;
    const data = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { data, contentType: mime };
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
  if (!res.ok) {
    throw new Error(`下载生成结果失败 (HTTP ${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type") || "application/octet-stream",
  };
}

/* -------------------------------------------------------------------------- */
/* Mock helpers                                                               */
/* -------------------------------------------------------------------------- */

function mockImageDataUri(prompt: string, ratio: string, seed: number) {
  const [w, h] = ratioSize(ratio);
  const hue = (seed * 47 + 210) % 360;
  const safe = prompt
    .slice(0, 120)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},70%,52%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 70) % 360},75%,32%)"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="50%" y="46%" fill="rgba(255,255,255,.92)" font-family="system-ui,sans-serif" font-size="${Math.round(
    Math.min(w, h) / 18,
  )}" text-anchor="middle">MOCK · ${ratio}</text>
  <text x="50%" y="56%" fill="rgba(255,255,255,.7)" font-family="system-ui,sans-serif" font-size="${Math.round(
    Math.min(w, h) / 34,
  )}" text-anchor="middle">${safe}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

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
