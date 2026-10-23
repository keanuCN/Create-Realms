import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getProviderSpec, testProvider } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ provider: string }>;
}

const schema = z.object({ credentials: z.record(z.string(), z.string().max(4096)).optional() });

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { provider } = await ctx.params;
    if (!getProviderSpec(provider)) return fail("未知的模型供应商", 404);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    const result = await testProvider(provider, parsed.success ? parsed.data.credentials : undefined, user.id);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
