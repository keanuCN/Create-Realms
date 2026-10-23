import { z } from "zod";
import { ApiError, fail, handleApiError, ok, requireApiUser } from "@/lib/http";
import { getPromptOptimizerConfigView, savePromptOptimizerConfig } from "@/lib/prompt-optimizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  apiKey: z.string().max(500).optional(),
  apiBase: z.string().trim().url().max(500),
  model: z.string().trim().min(1).max(100),
  clearKey: z.boolean().optional(),
});

async function requireAdmin() {
  const user = await requireApiUser();
  if (user.role !== "admin") throw new ApiError("需要管理员权限", 403);
}

export async function GET() {
  try {
    await requireAdmin();
    return ok(await getPromptOptimizerConfigView());
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.status);
    return handleApiError(error);
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiError(parsed.error.issues[0]?.message || "配置参数无效", 400);
    }
    const input = parsed.data;
    const current = await getPromptOptimizerConfigView();
    if (!current.configured && !input.apiKey?.trim()) {
      throw new ApiError("请先填写 DeepSeek API Key", 400);
    }
    return ok(await savePromptOptimizerConfig(input));
  } catch (error) {
    if (error instanceof ApiError) return fail(error.message, error.status);
    return handleApiError(error);
  }
}
