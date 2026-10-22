import { randomUUID } from "node:crypto";
import { rawRequest, trimBase } from "./http";
import {
  ProviderError,
  type AdapterContext,
  type ProviderAdapter,
  type TaskStatus,
  type VideoSubmitRequest,
} from "./types";

/**
 * 爱诗科技 PixVerse。
 * 认证：API-KEY 头 + 每次请求新建的 Ai-trace-id（UUID v4）。
 * 业务码在外层 ErrCode —— 注意「Key 缺失」也会返回 HTTP 200 + ErrCode 10004。
 */

interface Envelope<T> {
  ErrCode?: number;
  ErrMsg?: string;
  Resp?: T;
}

const TRACE_HEADERS = () => ({ "Ai-trace-id": randomUUID() });

async function call<T>(
  ctx: AdapterContext,
  path: string,
  init: RequestInit = {},
  timeoutMs = 60_000,
): Promise<T> {
  const res = await rawRequest<Envelope<T>>(`${trimBase(ctx.apiBase)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "API-KEY": ctx.apiKey,
      ...TRACE_HEADERS(),
      ...(init.headers ?? {}),
    },
  }, timeoutMs);

  const body = res.json;
  const code = Number(body?.ErrCode ?? -1);
  if (!res.ok || code !== 0) {
    throw new ProviderError(
      body?.ErrMsg || `PixVerse 接口错误 (HTTP ${res.status})`,
      String(code === -1 ? res.status : code),
      res.status,
    );
  }
  if (!body?.Resp) {
    throw new ProviderError("PixVerse 返回内容为空", "empty", res.status);
  }
  return body.Resp;
}

/** 图生视频/首尾帧需要先把图片上传换成 img_id。 */
async function uploadImage(ctx: AdapterContext, frame: { data: Buffer; mime: string }) {
  const extension = frame.mime.includes("jpeg") || frame.mime.includes("jpg") ? "jpg" : "png";
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(frame.data)], { type: frame.mime }), `frame.${extension}`);

  const res = await rawRequest<Envelope<{ img_id?: number }>>(
    `${trimBase(ctx.apiBase)}/openapi/v2/image/upload`,
    {
      method: "POST",
      // 注意：multipart 由 fetch 自己设置 boundary，不能手写 Content-Type
      headers: { "API-KEY": ctx.apiKey, ...TRACE_HEADERS() },
      body: form,
    },
    120_000,
  );

  const code = Number(res.json?.ErrCode ?? -1);
  if (!res.ok || code !== 0 || !res.json?.Resp?.img_id) {
    throw new ProviderError(
      res.json?.ErrMsg || "PixVerse 图片上传失败",
      String(code === -1 ? res.status : code),
      res.status,
    );
  }
  return res.json.Resp.img_id;
}

const STATUS_MAP: Record<number, TaskStatus["status"]> = {
  1: "succeeded", // 生成完成
  5: "running", // 生成中
  7: "failed", // 内容审核失败
  8: "failed", // 生成失败
};

export const pixverseAdapter: ProviderAdapter = {
  id: "pixverse",
  label: "爱诗科技 PixVerse",
  supportsVideo: true,
  supportsImage: false,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest): Promise<{ taskId: string }> {
    const base: Record<string, unknown> = {
      model: req.model,
      prompt: req.prompt,
      duration: req.duration ?? 5,
      quality: (req.resolution || "720p").replace("P", "p"),
      ...(req.seed != null ? { seed: req.seed } : {}),
    };
    // PixVerse 用 generate_audio_switch 控制是否出音频
    if (req.audio !== undefined) base.generate_audio_switch = req.audio;

    if (req.firstFrame && req.lastFrame) {
      const [firstId, lastId] = [
        await uploadImage(ctx, req.firstFrame),
        await uploadImage(ctx, req.lastFrame),
      ];
      const data = await call<{ video_id?: number }>(ctx, "/openapi/v2/video/transition/generate", {
        method: "POST",
        body: JSON.stringify({ ...base, first_frame_img: firstId, last_frame_img: lastId }),
      });
      if (!data.video_id) throw new ProviderError("PixVerse 未返回 video_id", "empty", 200);
      return { taskId: String(data.video_id) };
    }

    if (req.firstFrame) {
      const imgId = await uploadImage(ctx, req.firstFrame);
      const data = await call<{ video_id?: number }>(ctx, "/openapi/v2/video/img/generate", {
        method: "POST",
        body: JSON.stringify({ ...base, img_id: imgId }),
      });
      if (!data.video_id) throw new ProviderError("PixVerse 未返回 video_id", "empty", 200);
      return { taskId: String(data.video_id) };
    }

    const data = await call<{ video_id?: number }>(ctx, "/openapi/v2/video/text/generate", {
      method: "POST",
      body: JSON.stringify({ ...base, aspect_ratio: req.ratio || "16:9" }),
    });
    if (!data.video_id) throw new ProviderError("PixVerse 未返回 video_id", "empty", 200);
    return { taskId: String(data.video_id) };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    const data = await call<{
      id?: number;
      status?: number;
      url?: string;
      outputWidth?: number;
      outputHeight?: number;
      duration?: number;
      aspect_ratio?: string;
      quality?: string;
      credits?: number;
    }>(ctx, `/openapi/v2/video/result/${encodeURIComponent(String(taskId))}`, { method: "GET" }, 30_000);

    const raw = Number(data.status ?? 5);
    const status = STATUS_MAP[raw] ?? "running";
    const url = status === "succeeded" ? data.url : undefined;

    return {
      status,
      url,
      resolution: data.quality,
      duration: data.duration,
      ratio: data.aspect_ratio,
      usage: data.credits != null ? { credits: data.credits } : undefined,
      error:
        status === "failed"
          ? {
              code: String(raw),
              message: raw === 7 ? "内容审核未通过" : "PixVerse 生成失败",
            }
          : undefined,
    };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const res = await rawRequest<Envelope<{ credit_package?: number; credit_monthly?: number }>>(
        `${trimBase(ctx.apiBase)}/openapi/v2/account/balance`,
        { headers: { "API-KEY": ctx.apiKey, ...TRACE_HEADERS() } },
        20_000,
      );
      const code = Number(res.json?.ErrCode ?? -1);
      if (code === 10004) return { ok: false, message: "未携带 API Key（请求头缺失）" };
      if (code === 10005) return { ok: false, message: "Key 无效或未注册（鉴权失败）" };
      if (!res.ok || code !== 0) {
        return {
          ok: false,
          message: res.json?.ErrMsg || `PixVerse 返回错误（HTTP ${res.status}）`,
        };
      }
      const credits = Number(res.json?.Resp?.credit_package ?? 0);
      return { ok: true, message: `连接正常，Key 有效（剩余积分 ${credits}）` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? `测试失败：${error.message}` : "测试失败",
      };
    }
  },
};