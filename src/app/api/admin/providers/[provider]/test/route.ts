import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getProviderSpec, testProvider } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ provider: string }>;
}

const schema = z.object({
  /** 界面上刚填、还没保存的凭据；带上传入即可直接测试。 */
  credentials: z.record(z.string(), z.string().max(4096)).optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    if (user.role !== "admin") return fail("需要管理员权限", 403);

    const { provider } = await ctx.params;
    if (!getProviderSpec(provider)) return fail("未知的模型供应商", 404);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    const overrides = parsed.success ? parsed.data.credentials : undefined;

    const result = await testProvider(provider, overrides);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}