import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { getAsset } from "@/lib/assets";
import { sql } from "@/lib/db";
import { randomBytes } from "node:crypto";

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
      return fail("无权分享该作品", 403);
    }

    if (asset.shareToken) {
      return ok({ token: asset.shareToken });
    }

    const token = randomBytes(18).toString("base64url");
    await sql`
      INSERT INTO shares (asset_id, token, created_by)
      VALUES (${id}, ${token}, ${user.id})
    `;
    return ok({ token });
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
      return fail("无权操作该作品", 403);
    }
    await sql`DELETE FROM shares WHERE asset_id = ${id}`;
    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
