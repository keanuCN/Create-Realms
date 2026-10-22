import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getProviderSpec, listProviderViews, saveProviderConfig } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ provider: string }>;
}

const schema = z.object({
  /** 只提交改动过的凭据字段；空字符串表示清除该字段。 */
  credentials: z.record(z.string(), z.string().max(4096)).optional(),
  /** 兼容旧的单 Key 调用方式 */
  apiKey: z.string().max(4096).optional(),
  apiBase: z.string().trim().max(300).optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    if (user.role !== "admin") return fail("需要管理员权限", 403);

    const { provider } = await ctx.params;
    const spec = getProviderSpec(provider);
    if (!spec) return fail("未知的模型供应商", 404);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("参数错误", 400);

    const raw = parsed.data.credentials ?? {};
    const credentials: Record<string, string> = {};
    for (const field of spec.credentialFields) {
      const value = raw[field.key] ?? (field.key === "apiKey" ? parsed.data.apiKey : undefined);
      if (value === undefined) continue;
      const trimmed = value.trim();
      // 空白但非空字符串视为无效输入，避免误存
      if (trimmed && trimmed.length < 4) {
        return fail(`${field.label} 看起来太短了，请检查是否复制完整`, 400);
      }
      credentials[field.key] = trimmed;
    }

    const apiBase = parsed.data.apiBase?.trim();
    if (apiBase && !/^https?:\/\//.test(apiBase)) {
      return fail("Base URL 需要以 http:// 或 https:// 开头", 400);
    }

    await saveProviderConfig(
      provider,
      {
        credentials: Object.keys(credentials).length ? credentials : undefined,
        apiBase,
        enabled: parsed.data.enabled,
      },
      user.id,
    );

    const items = await listProviderViews();
    return ok({ items, saved: provider });
  } catch (error) {
    return handleApiError(error);
  }
}