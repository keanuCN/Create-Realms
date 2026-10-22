import { bearer, dataUri, rawRequest, trimBase } from "./http";
import {
  ProviderError,
  type AdapterContext,
  type ProviderAdapter,
  type TaskStatus,
  type VideoSubmitRequest,
} from "./types";

/**
 * 快手可灵 Kling（新版 API）。
 * 认证：Authorization: Bearer <API_KEY>，路径自带模型版本，无 /v1 前缀。
 * 例：POST /text-to-video/kling-2.6、POST /image-to-video/kling-2.6、GET /tasks?task_ids=
 */

interface KlingBody<T> {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
}

async function call<T>(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {},
  timeoutMs = 60_000,
): Promise<KlingBody<T>> {
  const res = await rawRequest<KlingBody<T>>(`${trimBase(ctx.apiBase)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...bearer(ctx.apiKey),
      ...(init.headers ?? {}),
    },
  }, timeoutMs);

  const body = res.json;
  const code = Number(body?.code ?? -1);

  if (!res.ok || code !== 0) {
    throw new ProviderError(
      body?.message || `可灵接口错误 (HTTP ${res.status})`,
      String(code === -1 ? res.status : code),
      res.status,
      body?.request_id,
    );
  }
  return body ?? {};
}

/** 创建任务返回的 id 字段在文档里没有完全统一，这里做兼容取值。 */
function pickTaskId(body: KlingBody<Record<string, unknown>>): string | null {
  const data = body.data as Record<string, unknown> | undefined;
  const candidates = [data?.id, data?.task_id, (body as Record<string, unknown>).id];
  for (const value of candidates) {
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

const STATUS_MAP: Record<string, TaskStatus["status"]> = {
  submitted: "queued",
  processing: "running",
  succeeded: "succeeded",
  succeed: "succeeded",
  failed: "failed",
};

interface KlingTask {
  id?: string;
  status?: string;
  task_status?: string;
  message?: string;
  task_status_msg?: string;
  outputs?: { type?: string; url?: string; duration?: string }[];
  task_result?: { videos?: { url?: string; duration?: string }[] };
}

function pickUrl(task: KlingTask): string | undefined {
  const fromOutputs = task.outputs?.find((item) => item.url)?.url;
  return fromOutputs ?? task.task_result?.videos?.[0]?.url ?? undefined;
}

export const klingAdapter: ProviderAdapter = {
  id: "kling",
  label: "可灵 AI",
  supportsVideo: true,
  supportsImage: false,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest): Promise<{ taskId: string }> {
    const settings: Record<string, unknown> = {
      resolution: (req.resolution || "1080p").toLowerCase(),
      duration: req.duration ?? 5,
      watermark_info: { enabled: false },
    };

    let path: string;
    let body: Record<string, unknown>;

    if (req.firstFrame || req.lastFrame) {
      path = `/image-to-video/${req.model}`;
      const contents: Record<string, unknown>[] = [
        { type: "prompt", text: req.prompt },
      ];
      if (req.firstFrame) {
        contents.push({ type: "first_frame", url: dataUri(req.firstFrame) });
      }
      if (req.lastFrame) {
        contents.push({ type: "last_frame", url: dataUri(req.lastFrame) });
      }
      body = { contents, settings };
    } else {
      path = `/text-to-video/${req.model}`;
      settings.aspect_ratio = req.ratio || "16:9";
      body = { prompt: req.prompt, settings };
    }

    const response = await call<Record<string, unknown>>(ctx, path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const taskId = pickTaskId(response);
    if (!taskId) throw new ProviderError("可灵未返回任务 id", "empty", 200);
    return { taskId };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    const response = await call<KlingTask | KlingTask[]>(
      ctx,
      `/tasks?task_ids=${encodeURIComponent(taskId)}`,
      { method: "GET" },
      30_000,
    );

    // 按 ID 查询时 data 是数组，这里两种形态都兼容
    const raw = response.data;
    const task: KlingTask | undefined = Array.isArray(raw) ? raw[0] : raw;
    if (!task) {
      throw new ProviderError("可灵未返回任务信息", "empty", 200);
    }

    const statusKey = String(task.status ?? task.task_status ?? "");
    const status = STATUS_MAP[statusKey] ?? "running";
    const message = task.message || task.task_status_msg || "";

    return {
      status,
      url: status === "succeeded" ? pickUrl(task) : undefined,
      duration: task.outputs?.[0]?.duration
        ? Number(task.outputs[0].duration)
        : undefined,
      error:
        status === "failed"
          ? { code: statusKey || "failed", message: klingMessage(message) }
          : undefined,
    };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const end = Date.now();
      const start = end - 3_600_000;
      const res = await rawRequest(
        `${trimBase(ctx.apiBase)}/account/costs?start_time=${start}&end_time=${end}`,
        { headers: bearer(ctx.apiKey) },
        20_000,
      );
      if (res.status === 401) {
        return { ok: false, message: "API Key 无效或已失效（可灵返回 401）" };
      }
      if (res.status === 403) {
        return { ok: false, message: "该 Key 无权限调用该接口（可灵返回 403）" };
      }
      const code = Number((res.json as { code?: number } | null)?.code ?? -1);
      if (!res.ok || code !== 0) {
        const message = (res.json as { message?: string } | null)?.message;
        return { ok: false, message: message || `可灵返回 HTTP ${res.status}` };
      }
      return { ok: true, message: "连接正常，Key 有效（该接口免费）" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? `测试失败：${error.message}` : "测试失败",
      };
    }
  },
};

function klingMessage(message: string): string {
  const map: Record<string, string> = {
    "1300": "触发平台策略，内容被拒绝",
    "1301": "触发内容安全策略，请调整提示词或参考图",
    "1302": "请求过于频繁，请稍后再试",
    "1303": "并发超出资源包限制，请稍后再试",
    "1101": "账户欠费",
    "1102": "资源包已用完或过期",
  };
  return message ? `可灵任务失败：${message}` : map["1301"];
}