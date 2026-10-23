import { z } from "zod";
import { requireApiUser, fail, ok, handleApiError, ApiError } from "@/lib/http";
import { createAsset } from "@/lib/assets";
import { durationAllowed, getModel, providerLabel } from "@/lib/models";
import { sql } from "@/lib/db";
import { isProviderReady } from "@/lib/providers";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["video", "image"]),
  model: z.string().min(1),
  prompt: z.string().trim().min(1, "请输入提示词"),
  title: z.string().trim().max(120).optional(),
  ratio: z.string().optional(),
  resolution: z.string().optional(),
  duration: z.number().int().optional(),
  /** 生成数量：视频为同一提示词生成多条，图片为多张 */
  n: z.number().int().min(1).max(4).optional(),
  seed: z.number().int().optional(),
  promptOptimizer: z.boolean().optional(),
  promptExpansion: z.enum(["disabled", "balanced", "quality"]).optional(),
  audio: z.boolean().optional(),
  firstFrameUploadId: z.string().uuid().optional(),
  lastFrameUploadId: z.string().uuid().optional(),
  referenceUploadIds: z.array(z.string().uuid()).max(10).optional(),
});

async function resolveUpload(userId: string, id?: string) {
  if (!id) return null;
  const rows = await sql<{ storage_key: string; mime: string }[]>`
    SELECT storage_key, mime FROM uploads WHERE id = ${id} AND user_id = ${userId} LIMIT 1
  `;
  if (!rows[0]) throw new ApiError("参考图不存在或已过期，请重新上传", 400);
  return rows[0];
}

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message || "参数错误", 400);
    }
    const input = parsed.data;
    const model = getModel(input.model);
    if (!model) throw new ApiError("未知模型", 400);
    if (model.availability === "coming-soon") {
      throw new ApiError("该模型暂未开放，当前不能提交生成任务", 400);
    }
    if (model.modality !== input.kind) throw new ApiError("模型与生成类型不匹配", 400);

    if (!(await isProviderReady(model.provider, user.id))) {
      throw new ApiError(
        `你还没有配置「${providerLabel(model.provider)}」的个人凭据，请到「我的模型 Key」页面填写并测试连接。`,
        503,
      );
    }

    const prompt = input.prompt.trim();
    if (prompt.length > model.maxPrompt) {
      throw new ApiError(`提示词过长（最多 ${model.maxPrompt} 字）`, 400);
    }

    const params: Record<string, unknown> = {};
    let count = 1;

    if (input.kind === "video") {
      const resolution = input.resolution ?? model.defaultResolution;
      if (resolution && !model.resolutions?.includes(resolution)) {
        throw new ApiError("不支持的分辨率", 400);
      }
      const duration = input.duration ?? model.defaultDuration ?? 5;
      if (!durationAllowed(model, duration)) {
        const range = model.durationRange;
        throw new ApiError(
          range ? `时长需要在 ${range.min}–${range.max} 秒之间` : "不支持的时长",
          400,
        );
      }
      params.resolution = resolution;
      params.duration = duration;

      const first = await resolveUpload(user.id, input.firstFrameUploadId);
      const last = await resolveUpload(user.id, input.lastFrameUploadId);
      const referenceIds = input.referenceUploadIds ?? [];
      const references = [];
      for (const id of referenceIds) {
        const upload = await resolveUpload(user.id, id);
        if (upload) references.push(upload);
      }

      if (model.id === "grok-imagine-video-1.5" && references.length && resolution === "1080p") {
        throw new ApiError("Grok Imagine 使用参考图时最高支持 720p，请调低分辨率后重试", 400);
      }

      const hasFrames = Boolean(first || last);
      if (hasFrames || references.length) {
        // 首尾帧与参考图是两种互斥的生成方式
        if (hasFrames && references.length) {
          throw new ApiError("首尾帧与参考图不能同时使用，请二选一", 400);
        }
        if (hasFrames) {
          if (!model.supportsFrames) throw new ApiError("该模型不支持参考图生视频", 400);
          if (last && !first) throw new ApiError("使用尾帧时必须同时提供首帧", 400);
          if (last && !model.supportsLastFrame) {
            throw new ApiError("该模型不支持尾帧，请只上传首帧", 400);
          }
        }
        if (references.length) {
          if (!model.supportsReferenceImages) {
            throw new ApiError(`「${model.label}」不支持参考图，请改用首帧或换个模型`, 400);
          }
          const max = model.maxReferenceImages ?? 4;
          if (references.length > max) {
            throw new ApiError(`该模型最多支持 ${max} 张参考图`, 400);
          }
        }
        if (first) {
          params.firstFrameKey = first.storage_key;
          params.firstFrameMime = first.mime;
        }
        if (last) {
          params.lastFrameKey = last.storage_key;
          params.lastFrameMime = last.mime;
        }
        if (references.length) {
          params.references = references.map((item) => ({
            key: item.storage_key,
            mime: item.mime,
          }));
        }
      } else {
        const ratio = input.ratio ?? model.defaultRatio ?? "16:9";
        if (!model.ratios?.includes(ratio)) {
          throw new ApiError("不支持的比例", 400);
        }
        params.ratio = ratio;
      }

      if (input.promptOptimizer === false) {
        params.promptOptimizer = false;
      } else if (input.promptOptimizer === true) {
        if (!model.supportsPromptOptimizer) {
          throw new ApiError(`「${model.label}」不支持提示词优化`, 400);
        }
        params.promptOptimizer = true;
      }
      if (input.promptExpansion && model.id === "MiniMax-H3-Max") {
        params.promptExpansion = input.promptExpansion;
      }

      if (input.audio !== undefined) {
        if (!model.supportsAudio) {
          throw new ApiError(`「${model.label}」不支持音频开关`, 400);
        }
        params.audio = input.audio;
      }

      count = Math.min(Math.max(input.n ?? 1, 1), model.maxVideos ?? 4);
      if (input.n && input.n > (model.maxVideos ?? 4)) {
        throw new ApiError(`该模型单次最多生成 ${model.maxVideos ?? 4} 条`, 400);
      }
    } else {
      const ratio = input.ratio ?? model.defaultRatio ?? "1:1";
      if (!model.ratios?.includes(ratio)) {
        throw new ApiError("不支持的比例", 400);
      }
      params.ratio = ratio;
      params.n = Math.min(input.n ?? 1, model.maxImages ?? 4);
      if (input.seed != null) params.seed = input.seed;
      params.promptOptimizer = input.promptOptimizer ?? true;
      if (model.resolutions?.length) {
        const resolution = input.resolution ?? model.defaultResolution;
        if (resolution && !model.resolutions.includes(resolution)) {
          throw new ApiError("不支持的图片尺寸", 400);
        }
        params.resolution = resolution;
      }
      // 图片的「数量」由适配器在一次请求里完成，不需要拆成多条任务
      const first = await resolveUpload(user.id, input.firstFrameUploadId);
      if (first) {
        params.firstFrameKey = first.storage_key;
        params.firstFrameMime = first.mime;
      }
    }

    const assets = [];
    for (let index = 0; index < count; index += 1) {
      const asset = await createAsset({
        userId: user.id,
        kind: input.kind,
        provider: model.provider,
        model: model.id,
        prompt,
        params:
          count > 1 ? { ...params, variant: index + 1, batchSize: count } : params,
      });
      assets.push(asset);
    }

    if (input.title && assets[0]) {
      await sql`UPDATE assets SET title = ${input.title} WHERE id = ${assets[0].id}`;
    }

    // asset 保留给旧调用方；assets 是本次批量创建的全部任务
    return ok({ asset: assets[0], assets }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
