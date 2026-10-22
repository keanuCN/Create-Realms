import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getProviderSpec, listProviderViews, saveProviderConfig } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ provider: string }>;
}

const schema = z.object({
  // undefined = keep current key; "" = clear it; otherwise the new key.
  apiKey: z.string().max(4096).optional(),
  apiBase: z.string().trim().max(300).optional(),
  enabled: z.boolean().optional(),
});

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    if (user.role !== "admin") return fail("需要管理员权限", 403);

    const { provider } = await ctx.params;
    if (!getProviderSpec(provider)) return fail("未知的模型供应商", 404);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("参数错误", 400);

    const apiKey = parsed.data.apiKey?.trim();
    if (apiKey && !/^https?:\/\//.test(apiKey) && apiKey.length < 8) {
      return fail("API Key 看起来太短了，请检查是否复制完整", 400);
    }
    const apiBase = parsed.data.apiBase?.trim();
    if (apiBase && !/^https?:\/\//.test(apiBase)) {
      return fail("Base URL 需要以 http:// 或 https:// 开头", 400);
    }

    await saveProviderConfig(
      provider,
      {
        apiKey: parsed.data.apiKey === undefined ? undefined : apiKey ?? "",
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