import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getAsset, updateAsset } from "@/lib/assets";
import { sql } from "@/lib/db";
import { mediaPath } from "@/lib/storage";
import { unlink } from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  title: z.string().trim().max(120).nullable().optional(),
  isFavorite: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const asset = await getAsset(id);
    if (!asset) return fail("作品不存在", 404);
    if (user.role !== "admin" && asset.userId !== user.id && !asset.isPublic) {
      return fail("无权访问该作品", 403);
    }
    return ok({ asset });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const asset = await getAsset(id);
    if (!asset) return fail("作品不存在", 404);
    if (user.role !== "admin" && asset.userId !== user.id) {
      return fail("无权修改该作品", 403);
    }

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("参数错误", 400);
    await updateAsset(id, parsed.data);
    const updated = await getAsset(id);
    return ok({ asset: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const user = await requireApiUser();
    const { id } = await ctx.params;
    const asset = await getAsset(id);
    if (!asset) return fail("作品不存在", 404);
    if (user.role !== "admin" && asset.userId !== user.id) {
      return fail("无权删除该作品", 403);
    }

    await sql`DELETE FROM assets WHERE id = ${id}`;

    for (const key of [asset.storageKey, asset.posterKey]) {
      if (!key) continue;
      try {
        await unlink(mediaPath(key));
      } catch {
        // ignore missing files
      }
    }

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
