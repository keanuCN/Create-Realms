import { bearer, rawRequest, trimBase } from "./http";
import {
  ProviderError,
  type AdapterContext,
  type ImageSubmitRequest,
  type ImageSubmitResult,
  type ProviderAdapter,
} from "./types";

interface OpenAIErrorBody {
  error?: { message?: string; code?: string };
}

interface OpenAIImageBody extends OpenAIErrorBody {
  data?: { b64_json?: string; url?: string }[];
}

function endpoint(ctx: AdapterContext, path: string) {
  const base = trimBase(ctx.apiBase);
  const versioned = /\/v1$/i.test(base) ? base : `${base}/v1`;
  return `${versioned}${path}`;
}

function imageSize(ratio = "1:1") {
  if (ratio === "3:2") return "1536x1024";
  if (ratio === "2:3") return "1024x1536";
  return "1024x1024";
}

function raiseOpenAIError(status: number, body: OpenAIErrorBody | null): never {
  const message = body?.error?.message || `OpenAI 接口错误 (HTTP ${status})`;
  throw new ProviderError(message, body?.error?.code || String(status), status);
}

export const openaiAdapter: ProviderAdapter = {
  id: "openai",
  label: "OpenAI",
  supportsVideo: false,
  supportsImage: true,

  async submitImage(ctx, req: ImageSubmitRequest): Promise<ImageSubmitResult> {
    const n = Math.max(1, Math.min(req.n ?? 1, 4));
    let response;

    if (req.referenceImage) {
      const form = new FormData();
      form.append("model", req.model);
      form.append("prompt", req.prompt);
      form.append("n", String(n));
      form.append("size", imageSize(req.ratio));
      form.append(
        "image",
        new Blob([new Uint8Array(req.referenceImage.data)], {
          type: req.referenceImage.mime || "image/png",
        }),
        req.referenceImage.mime?.includes("jpeg") ? "reference.jpg" : "reference.png",
      );
      response = await rawRequest<OpenAIImageBody>(
        endpoint(ctx, "/images/edits"),
        { method: "POST", headers: bearer(ctx.apiKey), body: form },
        240_000,
      );
    } else {
      response = await rawRequest<OpenAIImageBody>(
        endpoint(ctx, "/images/generations"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...bearer(ctx.apiKey) },
          body: JSON.stringify({
            model: req.model,
            prompt: req.prompt,
            size: imageSize(req.ratio),
            n,
          }),
        },
        240_000,
      );
    }

    if (!response.ok) raiseOpenAIError(response.status, response.json);

    const urls = (response.json?.data ?? [])
      .map((image) =>
        image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.url,
      )
      .filter((url): url is string => Boolean(url));
    if (!urls.length) throw new ProviderError("OpenAI 没有返回图片", "empty", 200);
    return { urls };
  },

  async verify(ctx) {
    if (!ctx.apiKey) return { ok: false, message: "还没有填写 API Key" };
    try {
      const response = await rawRequest<OpenAIErrorBody>(
        endpoint(ctx, "/models"),
        { headers: bearer(ctx.apiKey) },
        20_000,
      );
      if (!response.ok) {
        return {
          ok: false,
          message: response.json?.error?.message || `OpenAI 返回 HTTP ${response.status}`,
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
