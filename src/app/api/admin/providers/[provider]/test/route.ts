import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getProviderSpec, testProvider } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ provider: string }>;
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    if (user.role !== "admin") return fail("需要管理员权限", 403);

    const { provider } = await ctx.params;
    if (!getProviderSpec(provider)) return fail("未知的模型供应商", 404);

    const result = await testProvider(provider);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}