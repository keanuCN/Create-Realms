import { bearer, dataUri, rawRequest, trimBase } from "./http";
import {
  ProviderError,
  type AdapterContext,
  type ProviderAdapter,
  type TaskStatus,
  type VideoSubmitRequest,
} from "./types";

const MODEL_ID = "hy-video-v1.5";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface TencentError {
  code?: string | number;
  message?: string;
}

interface TencentTask extends TencentError {
  task_id?: string;
  status?: string;
  videos?: { url?: string; audio_url?: string }[];
  usage?: Record<string, unknown>;
  tokenhub_usage?: Record<string, unknown>;
  error?: TencentError | null;
}

interface TaskMetadata {
  taskId: string;
  duration?: number;
  ratio?: string;
}

function endpoint(ctx: AdapterContext, path: string) {
  const base = trimBase(ctx.apiBase);
  const versioned = /\/v1$/i.test(base) ? base : `${base}/v1`;
  return `${versioned}${path}`;
}

function packTask(taskId: string, req: VideoSubmitRequest) {
  return JSON.stringify({
    taskId,
    duration: 5,
    ratio: req.firstFrame ? undefined : req.ratio || "16:9",
  } satisfies TaskMetadata);
}

function unpackTask(value: string): TaskMetadata {
  try {
    const parsed = JSON.parse(value) as Partial<TaskMetadata>;
    if (typeof parsed.taskId === "string") {
      return {
        taskId: parsed.taskId,
        duration: typeof parsed.duration === "number" ? parsed.duration : undefined,
        ratio: typeof parsed.ratio === "string" ? parsed.ratio : undefined,
      };
    }
  } catch {
    // Older or manually restored task records may contain the raw task ID.
  }
  return { taskId: value };
}

function apiError(body: TencentTask | null, fallback: string) {
  const code = String(body?.error?.code || body?.code || "");
  const messages: Record<string, string> = {
    "1002": "腾讯云 TokenHub API Key 无效或已失效，请检查 Key 和 TokenHub 地域",
    "1003": "腾讯云 TokenHub API Key 尚未生效",
    "1004": "腾讯云 TokenHub API Key 已过期，请更新 Key",
    "1100": "腾讯云 TokenHub 账户异常，请检查账号状态",
    "1101": "腾讯云 TokenHub 后付费账户欠费，请先处理账单",
    "1102": "腾讯云 TokenHub 资源包已用完或过期",
    "1103": "当前 TokenHub Key 没有 Hy Video 1.5 的调用权限，请在控制台开通模型",
    "1200": "腾讯云 Hy Video 请求参数无效，请检查提示词、图片、时长或画面比例",
    "1201": "腾讯云 Hy Video 参数值不受支持，请检查输入设置",
    "1300": "提示词或参考图片未通过腾讯云内容审核，请调整后重试",
    "1301": "提示词命中腾讯云敏感词规则，请调整后重试",
    "1302": "腾讯云 TokenHub 请求过于频繁，请稍后重试",
    "1303": "腾讯云 Hy Video 并发或请求频率已达上限，请稍后重试",
    "1304": "腾讯云 TokenHub 按当前服务器 IP 拦截了请求",
    "5001": "腾讯云 Hy Video 服务暂时不可用，请稍后重试",
    "5002": "腾讯云 Hy Video 生成超时，请稍后重试",
  };
  return messages[code] || body?.error?.message || body?.message || fallback;
}

async function call<T>(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {},
  timeoutMs = 60_000,
) {
  const response = await rawRequest<T & TencentTask>(endpoint(ctx, path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...bearer(ctx.apiKey),
      ...(init.headers ?? {}),
    },
  }, timeoutMs);

  if (!response.ok) {
    const body = response.json;
    throw new ProviderError(
      apiError(body, `腾讯云 TokenHub 接口错误 (HTTP ${response.status})`),
      String(body?.error?.code || body?.code || response.status),
      response.status,
    );
  }
  if (!response.json) throw new ProviderError("腾讯云 TokenHub 返回了无法解析的响应", "invalid_response", 502);
  return response.json;
}

export const tencentHyAdapter: ProviderAdapter = {
  id: "tencent-hy",
  label: "腾讯混元 Hy Video",
  supportsVideo: true,
  supportsImage: false,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest) {
    if (req.lastFrame) {
      throw new ProviderError("Hy Video 1.5 目前只支持文生视频或单张首帧图生视频", "unsupported_input", 400);
    }

    const payload: Record<string, unknown> = {
      model: MODEL_ID,
      prompt: req.prompt,
      duration: 5,
      resolution: "720p",
      ...(req.seed != null ? { seed: req.seed } : {}),
    };
    if (req.firstFrame) {
      if (req.firstFrame.mime !== "image/jpeg" && req.firstFrame.mime !== "image/png") {
        throw new ProviderError("Hy Video 参考图仅支持 JPG 或 PNG，请转换格式后重新上传", "unsupported_image_type", 400);
      }
      if (req.firstFrame.data.byteLength > MAX_IMAGE_BYTES) {
        throw new ProviderError("Hy Video 参考图不能超过 10 MB，请压缩图片后重试", "image_too_large", 400);
      }
      payload.image = dataUri(req.firstFrame);
    } else {
      payload.aspect_ratio = req.ratio || "16:9";
    }

    const result = await call<TencentTask>(ctx, "/wand/hunyuan-video/generation", {
      method: "POST",
      body: JSON.stringify(payload),
    }, 120_000);

    if (result.status === "failed" || result.error) {
      throw new ProviderError(
        apiError(result, "Hy Video 任务提交失败"),
        String(result.error?.code || result.code || "submit_failed"),
        400,
      );
    }
    if (!result.task_id) throw new ProviderError("腾讯云 TokenHub 未返回 task_id", "empty", 200);
    return { taskId: packTask(result.task_id, req) };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    const metadata = unpackTask(taskId);
    const result = await call<TencentTask>(
      ctx,
      `/wand/hunyuan-video/tasks/${encodeURIComponent(metadata.taskId)}`,
      { method: "GET" },
      30_000,
    );
    const raw = String(result.status || "running").toLowerCase();

    if (raw === "queued") return { status: "queued" };
    if (raw === "running" || raw === "processing") return { status: "running" };
    if (raw === "failed") {
      return {
        status: "failed",
        error: {
          code: String(result.error?.code || result.code || "failed"),
          message: apiError(result, "Hy Video 生成失败"),
        },
      };
    }
    if (raw !== "succeeded" && raw !== "success" && raw !== "completed") {
      return { status: "running" };
    }

    const url = result.videos?.[0]?.url;
    if (!url) {
      return {
        status: "failed",
        error: { code: "no_output", message: "Hy Video 任务已完成，但没有返回视频地址" },
      };
    }
    return {
      status: "succeeded",
      url,
      duration: metadata.duration,
      resolution: "720p",
      ratio: metadata.ratio,
      usage: result.tokenhub_usage || result.usage,
    };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const result = await call<{ data?: { id?: string; status?: string }[] }>(ctx, "/models", {}, 20_000);
      const model = result.data?.find((item) => item.id === MODEL_ID);
      if (!model) {
        return {
          ok: false,
          message: "Key 有效，但模型列表中未发现 Hy Video 1.5；请检查 TokenHub 地域与模型开通状态",
        };
      }
      if (model.status && model.status !== "online") {
        return { ok: false, message: `Key 有效，但 Hy Video 1.5 当前状态为 ${model.status}` };
      }
      return { ok: true, message: "连接正常，Key 有效，Hy Video 1.5 已开放" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? `测试失败：${error.message}` : "测试失败",
      };
    }
  },
};
