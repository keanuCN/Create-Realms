import { requireApiUser, ok, handleApiError } from "@/lib/http";
import { incrementPromptUse } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    await incrementPromptUse(id, user.id);
    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
