import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getProviderSpec, listUserProviderViews, saveUserProviderCredentials } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ provider: string }>;
}

const schema = z.object({
  credentials: z.record(z.string(), z.string().max(4096)),
});

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { provider } = await ctx.params;
    const spec = getProviderSpec(provider);
    if (!spec) return fail("未知的模型供应商", 404);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("参数错误", 400);
    const credentials: Record<string, string> = {};
    for (const field of spec.credentialFields) {
      const value = parsed.data.credentials[field.key];
      if (value === undefined) continue;
      const trimmed = value.trim();
      if (trimmed && trimmed.length < 4) return fail(`${field.label} 看起来太短了，请检查是否复制完整`, 400);
      credentials[field.key] = trimmed;
    }
    await saveUserProviderCredentials(provider, credentials, user.id);
    return ok({ items: await listUserProviderViews(user.id), saved: provider });
  } catch (error) {
    return handleApiError(error);
  }
}
