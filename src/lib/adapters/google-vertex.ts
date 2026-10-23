import { createHash, createSign } from "node:crypto";
import { bearer, rawRequest, trimBase } from "./http";
import {
  ProviderError,
  type AdapterContext,
  type ProviderAdapter,
  type TaskStatus,
  type VideoSubmitRequest,
} from "./types";

const LOCATION = "us-central1";
const CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";

interface ServiceAccountKey {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
}

interface CloudErrorBody {
  error?: { code?: number | string; message?: string; status?: string };
}

interface VideoOutput {
  gcsUri?: string;
  uri?: string;
  bytesBase64Encoded?: string;
  mimeType?: string;
}

interface VeoOperation extends CloudErrorBody {
  name?: string;
  done?: boolean;
  error?: { code?: number | string; message?: string; status?: string };
  response?: {
    videos?: VideoOutput[];
    gcsUris?: string[];
    predictions?: Array<VideoOutput & { gcsUris?: string[]; videos?: VideoOutput[] }>;
    raiMediaFilteredCount?: number;
    raiMediaFilteredReasons?: string[];
  };
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function b64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function serviceAccount(ctx: AdapterContext): ServiceAccountKey {
  const raw = ctx.credentials.serviceAccountJson?.trim();
  if (!raw) throw new ProviderError("请填写 Google Cloud 服务账号 JSON Key", "missing_credentials", 400);

  let parsed: ServiceAccountKey;
  try {
    parsed = JSON.parse(raw) as ServiceAccountKey;
  } catch {
    throw new ProviderError("服务账号凭据不是有效的 JSON，请重新粘贴完整 JSON Key 文件内容", "invalid_credentials", 400);
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new ProviderError("服务账号 JSON 缺少 client_email 或 private_key", "invalid_credentials", 400);
  }
  const tokenUri = parsed.token_uri || GOOGLE_TOKEN_URI;
  try {
    const parsedUri = new URL(tokenUri);
    if (
      parsedUri.protocol !== "https:" ||
      parsedUri.hostname !== "oauth2.googleapis.com" ||
      parsedUri.pathname !== "/token"
    ) {
      throw new Error("unsupported token endpoint");
    }
  } catch {
    throw new ProviderError("服务账号 JSON 的 token_uri 不是受支持的 Google OAuth 地址", "invalid_credentials", 400);
  }
  return parsed;
}

async function accessToken(ctx: AdapterContext): Promise<string> {
  const key = serviceAccount(ctx);
  const cacheKey = createHash("sha256")
    .update(`${key.client_email}\n${key.private_key}`)
    .digest("hex");
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: CLOUD_SCOPE,
      aud: key.token_uri || GOOGLE_TOKEN_URI,
      iat: now,
      exp: now + 3600,
    }),
  );
  let signature: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    signer.end();
    signature = signer.sign(key.private_key!).toString("base64url");
  } catch {
    throw new ProviderError("服务账号私钥无法读取，请重新下载 JSON Key 并完整粘贴", "invalid_credentials", 400);
  }

  const assertion = `${header}.${claims}.${signature}`;
  const result = await rawRequest<{
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  }>(
    key.token_uri || GOOGLE_TOKEN_URI,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
    20_000,
  );

  if (!result.ok || !result.json?.access_token) {
    throw new ProviderError(
      result.json?.error_description || "Google Cloud 无法验证服务账号凭据，请检查 JSON Key 是否有效",
      String(result.status),
      result.status || 502,
    );
  }

  tokenCache.set(cacheKey, {
    token: result.json.access_token,
    expiresAt: Date.now() + Math.max(60, result.json.expires_in ?? 3600) * 1000,
  });
  return result.json.access_token;
}

function projectId(ctx: AdapterContext): string {
  const project = ctx.credentials.projectId?.trim();
  if (!project) throw new ProviderError("请填写 Google Cloud 项目 ID", "missing_credentials", 400);
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) {
    throw new ProviderError("Google Cloud 项目 ID 格式无效", "invalid_credentials", 400);
  }
  return project;
}

function apiBase(ctx: AdapterContext): string {
  const base = trimBase(ctx.apiBase);
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
}

function modelEndpoint(ctx: AdapterContext, model: string, action: string) {
  const project = encodeURIComponent(projectId(ctx));
  return `${apiBase(ctx)}/projects/${project}/locations/${LOCATION}/publishers/google/models/${encodeURIComponent(model)}:${action}`;
}

function imageInput(frame: NonNullable<VideoSubmitRequest["firstFrame"]>) {
  if (frame.mime !== "image/jpeg" && frame.mime !== "image/png") {
    throw new ProviderError("Veo 参考图仅支持 JPG 或 PNG，请转换格式后重新上传", "unsupported_image_type", 400);
  }
  return {
    bytesBase64Encoded: frame.data.toString("base64"),
    mimeType: frame.mime,
  };
}

function operationTaskId(name: string, req: VideoSubmitRequest): string {
  return JSON.stringify({
    name,
    model: req.model,
    duration: req.duration ?? 8,
    resolution: req.resolution ?? "720p",
    ratio: req.ratio ?? "16:9",
  });
}

function taskDetails(taskId: string) {
  try {
    const parsed = JSON.parse(taskId) as {
      name?: unknown;
      model?: unknown;
      duration?: unknown;
      resolution?: unknown;
      ratio?: unknown;
    };
    if (typeof parsed.name === "string") {
      return {
        name: parsed.name,
        model: typeof parsed.model === "string" ? parsed.model : "veo-3.1-generate-001",
        duration: typeof parsed.duration === "number" ? parsed.duration : undefined,
        resolution: typeof parsed.resolution === "string" ? parsed.resolution : undefined,
        ratio: typeof parsed.ratio === "string" ? parsed.ratio : undefined,
      };
    }
  } catch {
    // Older or manually restored task IDs are handled as raw operation names.
  }
  return {
    name: taskId,
    model: "veo-3.1-generate-001",
    duration: undefined,
    resolution: undefined,
    ratio: undefined,
  };
}

async function cloudJson<T>(
  ctx: AdapterContext,
  url: string,
  method: "GET" | "POST",
  body?: unknown,
  timeoutMs = 60_000,
): Promise<T> {
  const token = await accessToken(ctx);
  const response = await rawRequest<T & CloudErrorBody>(
    url,
    {
      method,
      headers: {
        ...bearer(token),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    timeoutMs,
  );
  if (!response.ok) {
    const providerMessage = response.json?.error?.message;
    const message = response.status === 403
      ? `Google Cloud 拒绝了 Veo 请求（403）。请确认已启用 Agent Platform API，并为服务账号授予 Vertex AI User 权限。${providerMessage ? ` ${providerMessage}` : ""}`
      : providerMessage || `Google Cloud Veo 接口错误 (HTTP ${response.status})`;
    throw new ProviderError(message, String(response.status), response.status);
  }
  if (!response.json) throw new ProviderError("Google Cloud Veo 返回了空响应", "empty", 502);
  return response.json;
}

function outputCandidates(result: VeoOperation["response"]): VideoOutput[] {
  if (!result) return [];
  const outputs: VideoOutput[] = [...(result.videos ?? [])];
  for (const prediction of result.predictions ?? []) {
    outputs.push(...(prediction.videos ?? []));
    if (prediction.bytesBase64Encoded || prediction.gcsUri || prediction.uri) {
      outputs.push(prediction);
    }
    for (const uri of prediction.gcsUris ?? []) outputs.push({ gcsUri: uri });
  }
  for (const uri of result.gcsUris ?? []) outputs.push({ gcsUri: uri });
  return outputs;
}

async function downloadGcsVideo(ctx: AdapterContext, uri: string) {
  const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new ProviderError("Veo 返回了无法识别的视频地址", "bad_response", 502);
  const [, bucket, object] = match;
  const token = await accessToken(ctx);
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(object)}?alt=media`;
  const response = await fetch(url, {
    headers: bearer(token),
    signal: AbortSignal.timeout(300_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const message = response.status === 403
      ? "Veo 已生成视频，但服务账号没有读取 Google Cloud Storage 文件的权限。请为该账号授予对应存储桶的对象查看者权限后重试。"
      : `下载 Google Cloud 视频失败 (HTTP ${response.status})`;
    throw new ProviderError(message, String(response.status), response.status);
  }
  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "video/mp4",
  };
}

export const googleVertexAdapter: ProviderAdapter = {
  id: "google-vertex",
  label: "Google Cloud Veo",
  supportsVideo: true,
  supportsImage: false,
  frameInput: "base64",

  async submitVideo(ctx, req: VideoSubmitRequest) {
    const instance: Record<string, unknown> = { prompt: req.prompt };
    const references = req.referenceImages ?? [];
    if (req.firstFrame && !["image/jpeg", "image/png"].includes(req.firstFrame.mime)) {
      throw new ProviderError("Veo 参考图仅支持 JPG 或 PNG，请转换格式后重新上传", "unsupported_image_type", 400);
    }
    if (req.lastFrame && !["image/jpeg", "image/png"].includes(req.lastFrame.mime)) {
      throw new ProviderError("Veo 尾帧仅支持 JPG 或 PNG，请转换格式后重新上传", "unsupported_image_type", 400);
    }
    if (references.length && req.model === "veo-3.1-generate-001" && (req.duration ?? 8) !== 8) {
      throw new ProviderError("Veo 3.1 使用主体参考图时仅支持生成 8 秒视频", "unsupported_duration", 400);
    }
    if (req.firstFrame) instance.image = imageInput(req.firstFrame);
    if (req.lastFrame) instance.lastFrame = imageInput(req.lastFrame);
    if (references.length) {
      if (req.model.includes("lite")) {
        throw new ProviderError("Veo 3.1 Lite 暂不支持主体参考图，请改用首帧或其他 Veo 型号", "unsupported", 400);
      }
      instance.referenceImages = references.map((image) => ({
        image: imageInput(image),
        referenceType: "asset",
      }));
    }

    const duration = req.duration ?? 8;
    const resolution = req.resolution ?? "720p";
    const ratio = req.ratio ?? "16:9";
    const response = await cloudJson<VeoOperation>(
      ctx,
      modelEndpoint(ctx, req.model, "predictLongRunning"),
      "POST",
      {
        instances: [instance],
        parameters: {
          aspectRatio: ratio,
          durationSeconds: duration,
          resolution,
          sampleCount: 1,
          generateAudio: req.audio ?? true,
          task: references.length ? "referenceToVideo" : req.firstFrame ? "imageToVideo" : "textToVideo",
          ...(req.seed == null ? {} : { seed: req.seed }),
        },
      },
      120_000,
    );

    if (!response.name) throw new ProviderError("Google Cloud Veo 未返回任务 ID", "empty", 502);
    return { taskId: operationTaskId(response.name, req) };
  },

  async pollVideo(ctx, taskId): Promise<TaskStatus> {
    const task = taskDetails(taskId);
    const operation = await cloudJson<VeoOperation>(
      ctx,
      modelEndpoint(ctx, task.model, "fetchPredictOperation"),
      "POST",
      { operationName: task.name },
      60_000,
    );

    if (operation.error) {
      return {
        status: "failed",
        error: {
          code: String(operation.error.code ?? operation.error.status ?? "veo_failed"),
          message: operation.error.message || "Google Cloud Veo 生成失败",
        },
      };
    }
    if (!operation.done) return { status: "running" };

    const outputs = outputCandidates(operation.response);
    const directOutput = outputs.find((item) => item.bytesBase64Encoded);
    if (directOutput?.bytesBase64Encoded) {
      return {
        status: "succeeded",
        data: Buffer.from(directOutput.bytesBase64Encoded, "base64"),
        contentType: directOutput.mimeType || "video/mp4",
        duration: task.duration,
        resolution: task.resolution,
        ratio: task.ratio,
      };
    }

    const uri = outputs.find((item) => item.gcsUri || item.uri)?.gcsUri ??
      outputs.find((item) => item.uri)?.uri;
    if (uri) {
      const file = await downloadGcsVideo(ctx, uri);
      return {
        status: "succeeded",
        ...file,
        duration: task.duration,
        resolution: task.resolution,
        ratio: task.ratio,
      };
    }

    const filteredReasons = operation.response?.raiMediaFilteredReasons ?? [];
    if ((operation.response?.raiMediaFilteredCount ?? 0) > 0 || filteredReasons.length) {
      return {
        status: "failed",
        error: {
          code: "rai_filtered",
          message: filteredReasons[0] ||
            "Veo 的安全审核拦截了本次输入或输出，请调整提示词或参考图后重新生成。",
        },
      };
    }
    return {
      status: "failed",
      error: { code: "empty_output", message: "Google Cloud Veo 任务已完成，但没有返回视频文件" },
    };
  },

  async verify(ctx) {
    try {
      const project = projectId(ctx);
      const token = await accessToken(ctx);
      const locationUrl = `${apiBase(ctx)}/projects/${encodeURIComponent(project)}/locations/${LOCATION}`;
      const response = await rawRequest<CloudErrorBody>(locationUrl, {
        headers: bearer(token),
      }, 20_000);
      if (!response.ok) {
        if (response.status === 403) {
          return { ok: false, message: "服务账号能通过身份验证，但没有查询此项目/区域的权限。请确认已启用 Agent Platform API，并授予 Vertex AI User。" };
        }
        return {
          ok: false,
          message: response.json?.error?.message || `Google Cloud 返回 HTTP ${response.status}`,
        };
      }
      return { ok: true, message: "服务账号验证正常；Veo 模型权限和配额会在首次生成时确认。" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Google Cloud 凭据测试失败",
      };
    }
  },
};
