import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getAsset } from "@/lib/assets";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const asset = await getAsset(id);
    if (!asset) return fail("作品不存在", 404);
    if (user.role !== "admin" && asset.userId !== user.id) {
      return fail("无权操作该作品", 403);
    }
    if (!["failed", "cancelled"].includes(asset.status)) {
      return fail("只有失败的任务可以重试", 400);
    }

    await sql`
      UPDATE assets SET
        status = 'pending',
        attempts = 0,
        provider_task_id = NULL,
        next_run_at = now(),
        locked_at = NULL,
        error_code = NULL,
        error_message = NULL,
        completed_at = NULL,
        updated_at = now()
      WHERE id = ${id}
    `;
    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
