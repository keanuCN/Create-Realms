import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { deletePrompt, updatePrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  content: z.string().trim().min(1).max(7000).optional(),
  tags: z.array(z.string().trim().max(24)).max(8).optional(),
  kind: z.enum(["video", "image", "any"]).optional(),
  isShared: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("参数错误", 400);
    const changed = await updatePrompt(id, user.id, parsed.data);
    if (!changed) return fail("提示词不存在或无权限", 404);
    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const deleted = await deletePrompt(id, user.id);
    if (!deleted) return fail("提示词不存在或无权限", 404);
    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
