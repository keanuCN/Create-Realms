import { z } from "zod";
import { requireApiUser, fail, ok, handleApiError, ApiError } from "@/lib/http";
import { createAsset } from "@/lib/assets";
import { getModel } from "@/lib/models";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
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
  n: z.number().int().min(1).max(4).optional(),
  seed: z.number().int().optional(),
  promptOptimizer: z.boolean().optional(),
  promptExpansion: z.enum(["disabled", "balanced", "quality"]).optional(),
  firstFrameUploadId: z.string().uuid().optional(),
  lastFrameUploadId: z.string().uuid().optional(),
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
    if (!env.minimax.mock && !(await isProviderReady("minimax"))) {
      throw new ApiError(
        "还没有配置 MiniMax API Key，请让管理员到「模型设置」页面填写。",
        503,
      );
    }

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message || "参数错误", 400);
    }
    const input = parsed.data;
    const model = getModel(input.model);
    if (!model) throw new ApiError("未知模型", 400);
    if (model.modality !== input.kind) throw new ApiError("模型与生成类型不匹配", 400);

    const prompt = input.prompt.trim();
    if (prompt.length > model.maxPrompt) {
      throw new ApiError(`提示词过长（最多 ${model.maxPrompt} 字）`, 400);
    }

    const params: Record<string, unknown> = {};

    if (input.kind === "video") {
      const resolution = input.resolution ?? model.defaultResolution ?? "768P";
      if (!model.resolutions?.includes(resolution)) {
        throw new ApiError("不支持的分辨率", 400);
      }
      const duration = input.duration ?? model.defaultDuration ?? 5;
      if (!model.durations?.includes(duration)) {
        throw new ApiError("不支持的时长", 400);
      }
      params.resolution = resolution;
      params.duration = duration;

      if (input.firstFrameUploadId || input.lastFrameUploadId) {
        if (!model.supportsFrames) {
          throw new ApiError("该模型不支持首尾帧参考", 400);
        }
        const first = await resolveUpload(user.id, input.firstFrameUploadId);
        const last = await resolveUpload(user.id, input.lastFrameUploadId);
        if (last && !first) {
          throw new ApiError("使用尾帧时必须同时提供首帧", 400);
        }
        if (first) {
          params.firstFrameKey = first.storage_key;
          params.firstFrameMime = first.mime;
        }
        if (last) {
          params.lastFrameKey = last.storage_key;
          params.lastFrameMime = last.mime;
        }
      } else {
        const ratio = input.ratio ?? model.defaultRatio ?? "16:9";
        if (!model.ratios?.includes(ratio)) {
          throw new ApiError("不支持的比例", 400);
        }
        params.ratio = ratio;
      }

      if (input.promptExpansion) {
        params.promptExpansion = input.promptExpansion;
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
    }

    const asset = await createAsset({
      userId: user.id,
      kind: input.kind,
      provider: model.provider,
      model: model.id,
      prompt,
      params,
    });

    if (input.title) {
      await sql`UPDATE assets SET title = ${input.title} WHERE id = ${asset.id}`;
    }

    return ok({ asset }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
