import { z } from "zod";
import { fail, handleApiError, ok, requireApiUser, ApiError } from "@/lib/http";
import { getModel } from "@/lib/models";
import { getPromptOptimizerConfig } from "@/lib/prompt-optimizer";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["video", "image"]),
  model: z.string().min(1),
  prompt: z.string().trim().min(1, "请输入提示词").max(7000, "提示词过长"),
});

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export async function POST(req: Request) {
  try {
    await requireApiUser();

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message || "参数错误", 400);
    }
    const input = parsed.data;
    const model = getModel(input.model);
    if (!model || model.modality !== input.kind) {
      throw new ApiError("生成类型与模型不匹配", 400);
    }
    if (input.prompt.length > model.maxPrompt) {
      throw new ApiError(`当前模型的提示词上限为 ${model.maxPrompt} 字`, 400);
    }

    const optimizer = await getPromptOptimizerConfig();
    if (!optimizer.apiKey) {
      throw new ApiError("团队尚未配置 DeepSeek 提示词优化 Key，请联系管理员。", 503);
    }

    const kindLabel = input.kind === "video" ? "视频" : "图片";
    const response = await fetch(`${optimizer.apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${optimizer.apiKey}`,
      },
      body: JSON.stringify({
        model: optimizer.model,
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `你是造境的${kindLabel}提示词优化助手。将用户给出的简短描述改写为适合${kindLabel}生成模型的清晰、具体、连贯提示词。保留原意与主体，补足合理的环境、构图、光线、镜头或材质细节；避免自相矛盾、无关扩写和解释。只输出优化后的提示词正文，不要标题、引号、列表、分析或 Markdown。长度控制在 ${model.maxPrompt} 字以内。`,
          },
          { role: "user", content: input.prompt },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
    if (!response.ok) {
      const detail = result?.error?.message;
      console.error("[prompt-optimize] DeepSeek request failed", response.status, detail);
      throw new ApiError(detail || `提示词优化服务暂不可用（HTTP ${response.status}）`, 502);
    }

    const optimized = result?.choices?.[0]?.message?.content?.trim();
    if (!optimized) throw new ApiError("模型没有返回优化后的提示词，请重试。", 502);
    if (optimized.length > model.maxPrompt) {
      throw new ApiError(`优化结果超过当前模型的 ${model.maxPrompt} 字限制，请缩短原始提示词后重试。`, 422);
    }

    return ok({ prompt: optimized });
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.status);
    return handleApiError(error);
  }
}
