import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { hashPassword } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  role: z.enum(["admin", "member"]).optional(),
  disabled: z.boolean().optional(),
  password: z.string().min(6).max(128).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const admin = await requireApiUser();
    if (admin.role !== "admin") return fail("需要管理员权限", 403);

    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("参数错误", 400);

    if (id === admin.id && (parsed.data.disabled || parsed.data.role === "member")) {
      return fail("不能禁用或降级当前登录的管理员", 400);
    }

    const sets: ReturnType<typeof sql>[] = [];
    if (parsed.data.displayName !== undefined) {
      sets.push(sql`display_name = ${parsed.data.displayName}`);
    }
    if (parsed.data.role !== undefined) sets.push(sql`role = ${parsed.data.role}`);
    if (parsed.data.disabled !== undefined) {
      sets.push(sql`disabled = ${parsed.data.disabled}`);
    }
    if (parsed.data.password !== undefined) {
      sets.push(sql`password_hash = ${hashPassword(parsed.data.password)}`);
    }
    if (!sets.length) return ok({ ok: true });

    const setClause = sets.reduce((acc, s, i) => (i === 0 ? s : sql`${acc}, ${s}`), sql``);
    const rows = await sql`
      UPDATE users SET ${setClause} WHERE id = ${id} RETURNING id
    `;
    if (!rows.length) return fail("用户不存在", 404);

    if (parsed.data.disabled === true || parsed.data.password !== undefined) {
      await sql`DELETE FROM sessions WHERE user_id = ${id}`;
    }

    return ok({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
