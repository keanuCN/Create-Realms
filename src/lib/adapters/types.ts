import type { Buffer } from "node:buffer";

export type Credentials = Record<string, string>;

export interface AdapterContext {
  provider: string;
  apiBase: string;
  /** Convenience accessor for the common single-key case. */
  apiKey: string;
  credentials: Credentials;
}

export interface FrameInput {
  data: Buffer;
  mime: string;
}

export type PromptExpansion = "disabled" | "balanced" | "quality";

export interface VideoSubmitRequest {
  model: string;
  prompt: string;
  resolution?: string;
  duration?: number;
  ratio?: string;
  firstFrame?: FrameInput | null;
  lastFrame?: FrameInput | null;
  /** 主体/风格参考图（参考生视频），与首尾帧互斥 */
  referenceImages?: FrameInput[];
  /** 是否生成音频；undefined = 用供应商默认值 */
  audio?: boolean;
  /** 是否开启提示词扩写；undefined = 用供应商默认值 */
  promptOptimizer?: boolean;
  promptExpansion?: PromptExpansion;
  seed?: number;
}

export interface VideoSubmitResult {
  /** 异步 API 返回的任务 ID。 */
  taskId?: string;
  /** 同步 API 可直接返回下载地址。 */
  url?: string;
  /** 同步 API 可直接返回二进制内容，避免把大文件临时编码进数据库字段。 */
  data?: Buffer;
  contentType?: string;
  resolution?: string;
  duration?: number;
  ratio?: string;
  usage?: Record<string, unknown>;
}

export type TaskState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface TaskStatus {
  status: TaskState;
  /** Single output (video). */
  url?: string;
  /** Multiple outputs (images). */
  urls?: string[];
  error?: { code?: string; message?: string };
  resolution?: string;
  duration?: number;
  ratio?: string;
  usage?: Record<string, unknown>;
}

export interface ImageSubmitRequest {
  model: string;
  prompt: string;
  ratio?: string;
  resolution?: string;
  n?: number;
  seed?: number;
  promptOptimizer?: boolean;
  referenceImage?: FrameInput | null;
}

export interface ImageSubmitResult {
  /** Async providers return a task id to poll. */
  taskId?: string;
  /** Synchronous providers return the finished URLs right away. */
  urls?: string[];
  failedCount?: number;
}

/**
 * A provider adapter. Async task APIs implement submit + poll; the worker
 * drives the polling loop so long jobs never block other jobs.
 */
export interface ProviderAdapter {
  id: string;
  label: string;
  supportsVideo: boolean;
  supportsImage: boolean;
  /** Image-to-video input format the provider accepts. */
  frameInput?: "base64" | "url" | "both";
  submitVideo?(ctx: AdapterContext, req: VideoSubmitRequest): Promise<VideoSubmitResult>;
  pollVideo?(ctx: AdapterContext, taskId: string): Promise<TaskStatus>;
  submitImage?(ctx: AdapterContext, req: ImageSubmitRequest): Promise<ImageSubmitResult>;
  pollImage?(ctx: AdapterContext, taskId: string): Promise<TaskStatus>;
  /** Free credential check; must not consume generation quota. */
  verify(ctx: AdapterContext): Promise<{ ok: boolean; message: string }>;
}

export class ProviderError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(message: string, code: string, status = 500, requestId?: string) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}
