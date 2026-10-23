import { bearer, rawRequest, trimBase } from "./http";
import { friendlyError } from "../errors";
import {
  ProviderError,
  type AdapterContext,
  type ImageSubmitRequest,
  type ImageSubmitResult,
  type ProviderAdapter,
  type VideoSubmitRequest,
} from "./types";

interface GoogleErrorBody {
  error?: { message?: string; status?: string; code?: string | number };
}

interface GoogleContent {
  type?: string;
  data?: string;
  uri?: string;
  mime_type?: string;
}

interface GoogleInteraction extends GoogleErrorBody {
  steps?: { type?: string; content?: GoogleContent[] }[];
  output_image?: GoogleContent;
  output_video?: GoogleContent;
  status?: string;
}

function endpoint(ctx: AdapterContext, path: string) {
  const base = trimBase(ctx.apiBase);
  const versioned = /\/v1beta$/i.test(base) ? base : `${base}/v1beta`;
  return `${versioned}${path}`;
}

function raiseGoogleError(status: number, body: GoogleErrorBody | null): never {
  const providerMessage = body?.error?.message || "";
  const projectAccessDenied = /project has been denied access/i.test(providerMessage);
  const freeTierZeroQuota =
    /limit:\s*0/i.test(providerMessage) && /free\s*tier/i.test(providerMessage);
  const message = projectAccessDenied
    ? "Google 已拒绝当前项目访问 Gemini API（403 权限错误），本次未能生成。请在 Google AI Studio 核对 API Key 对应的项目及项目状态；如果项目显示 Restricted、Unavailable，或已完成计费设置仍报此错，请联系 Google AI 支持并提供此 403 错误。查看项目与配额：https://aistudio.google.com/"
    : freeTierZeroQuota
    ? "图片未生成：当前 Google API Key 所属项目的免费层没有该 Gemini 图片模型的调用额度（每日限额为 0）。请管理员在 Google AI Studio 为这个项目启用计费并确认付费层已生效后重试；也可以切换到其他已配置的图片模型。查看项目限额：https://ai.dev/rate-limit"
    : providerMessage || `Google Gemini 接口错误 (HTTP ${status})`;
  const code = typeof body?.error?.code === "string"
    ? body.error.code
    : body?.error?.status || String(status);
  throw new ProviderError(friendlyError(code, message), code, status);
}

function outputParts(data: GoogleInteraction, type: "image" | "video"): GoogleContent[] {
  const convenience = type === "image" ? data.output_image : data.output_video;
  if (convenience?.data || convenience?.uri) return [convenience];
  return (data.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === type && (content.data || content.uri));
}

function ratioTag(ratio: string) {
  return ratio === "9:16" ? "9:16" : "16:9";
}

function imageSize(resolution?: string) {
  const value = resolution?.toUpperCase();
  if (value === "0.5K") return "512";
  return value === "2K" || value === "4K" ? value : "1K";
}

function videoResolution(resolution?: string) {
  const value = resolution?.toLowerCase();
  if (value === "360p" || value === "1080p" || value === "4k") return value;
  return "720p";
}

async function createInteraction(
  ctx: AdapterContext,
  body: Record<string, unknown>,
  timeoutMs = 240_000,
) {
  const response = await rawRequest<GoogleInteraction>(
    endpoint(ctx, "/interactions"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": ctx.apiKey },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  if (!response.ok) raiseGoogleError(response.status, response.json);
  if (!response.json) throw new ProviderError("Gemini 返回了空响应", "empty", 200);
  return response.json;
}

function imageInputs(prompt: string, image?: ImageSubmitRequest["referenceImage"]) {
  if (!image) return prompt;
  return [
    { type: "image", data: image.data.toString("base64"), mime_type: image.mime },
    { type: "text", text: prompt },
  ];
}

function videoInputs(req: VideoSubmitRequest) {
  const inputs: Record<string, string>[] = [];
  const roleTags: string[] = [];
  if (req.firstFrame) {
    inputs.push({
      type: "image",
      data: req.firstFrame.data.toString("base64"),
      mime_type: req.firstFrame.mime,
    });
    roleTags.push("<FIRST_FRAME>");
  }
  if (req.lastFrame) {
    inputs.push({
      type: "image",
      data: req.lastFrame.data.toString("base64"),
      mime_type: req.lastFrame.mime,
    });
    roleTags.push("<LAST_FRAME>");
  }
  for (const [index, image] of (req.referenceImages ?? []).entries()) {
    inputs.push({
      type: "image",
      data: image.data.toString("base64"),
      mime_type: image.mime,
    });
    roleTags.push(`<IMAGE_REF_${index}>`);
  }

  const promptParts = [...roleTags, req.prompt];
  if (req.duration) promptParts.push(`Create a video approximately ${req.duration} seconds long.`);
  if (req.audio === false) promptParts.push("Do not include audio, music, or dialogue.");
  inputs.push({ type: "text", text: promptParts.join(" ") });
  return inputs;
}

async function downloadGoogleVideo(ctx: AdapterContext, uri: string): Promise<Buffer> {
  const fileId = uri.match(/\/files\/([^/:?]+)/)?.[1];
  if (!fileId) throw new ProviderError("Gemini 返回的视频文件地址无法识别", "bad_response", 502);

  const deadline = Date.now() + 10 * 60_000;
  let active = false;
  while (Date.now() < deadline) {
    const status = await rawRequest<{ state?: string } & GoogleErrorBody>(
      endpoint(ctx, `/files/${encodeURIComponent(fileId)}`),
      { headers: { "x-goog-api-key": ctx.apiKey } },
      30_000,
    );
    if (!status.ok) raiseGoogleError(status.status, status.json);
    const state = status.json?.state?.toUpperCase();
    if (state === "FAILED") {
      throw new ProviderError("Gemini 视频文件处理失败", "failed", 502);
    }
    if (state === "ACTIVE") {
      active = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  if (!active) {
    throw new ProviderError("等待 Gemini 视频文件就绪超时", "timeout", 504);
  }

  const downloadUrl = uri.includes(":download")
    ? uri
    : `${endpoint(ctx, `/files/${encodeURIComponent(fileId)}`)}:download?alt=media`;
  const response = await fetch(downloadUrl, {
    headers: { "x-goog-api-key": ctx.apiKey },
    signal: AbortSignal.timeout(300_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ProviderError(`下载 Gemini 视频失败 (HTTP ${response.status})`, String(response.status), response.status);
  }
  return Buffer.from(await response.arrayBuffer());
}

export const googleAdapter: ProviderAdapter = {
  id: "google",
  label: "Google Gemini",
  supportsVideo: true,
  supportsImage: true,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest) {
    const task = req.referenceImages?.length
      ? "reference_to_video"
      : req.firstFrame
        ? "image_to_video"
        : "text_to_video";
    const data = await createInteraction(
      ctx,
      {
        model: req.model,
        input: videoInputs(req),
        response_format: {
          type: "video",
          delivery: "uri",
          aspect_ratio: ratioTag(req.ratio || "16:9"),
          resolution: videoResolution(req.resolution),
        },
        generation_config: { video_config: { task } },
      },
      600_000,
    );

    const output = outputParts(data, "video")[0];
    if (output?.data) {
      return {
        data: Buffer.from(output.data, "base64"),
        contentType: output.mime_type || "video/mp4",
        resolution: req.resolution,
        duration: req.duration,
        ratio: req.ratio,
      };
    }
    if (output?.uri) {
      return {
        data: await downloadGoogleVideo(ctx, output.uri),
        contentType: output.mime_type || "video/mp4",
        resolution: req.resolution,
        duration: req.duration,
        ratio: req.ratio,
      };
    }
    throw new ProviderError("Gemini 没有返回视频文件", "empty", 200);
  },

  async submitImage(ctx, req: ImageSubmitRequest): Promise<ImageSubmitResult> {
    const count = Math.max(1, Math.min(req.n ?? 1, 4));
    const urls: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const data = await createInteraction(ctx, {
        model: req.model,
        input: imageInputs(req.prompt, req.referenceImage),
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: req.ratio || "1:1",
          image_size: imageSize(req.resolution),
        },
      });
      const output = outputParts(data, "image").find((part) => part.data);
      if (output?.data) {
        urls.push(`data:${output.mime_type || "image/jpeg"};base64,${output.data}`);
      }
    }
    if (!urls.length) throw new ProviderError("Gemini 没有返回图片", "empty", 200);
    return { urls };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const response = await rawRequest<{ models?: unknown[] } & GoogleErrorBody>(
        endpoint(ctx, "/models"),
        { headers: { "x-goog-api-key": ctx.apiKey } },
        20_000,
      );
      if (!response.ok) {
        return {
          ok: false,
          message: response.json?.error?.message || `Google Gemini 返回 HTTP ${response.status}`,
        };
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
