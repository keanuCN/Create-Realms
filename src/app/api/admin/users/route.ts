import { z } from "zod";
import { requireApiUser, ok, fail, handleApiError, ApiError } from "@/lib/http";
import { createUser, toUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "用户名至少 2 个字符")
    .max(32, "用户名最多 32 个字符")
    .regex(/^[\p{L}\p{N}_.-]+$/u, "用户名只能包含中文、字母、数字、下划线、点和横线"),
  displayName: z.string().trim().max(40).optional(),
  password: z.string().min(6, "密码至少 6 位").max(128),
  role: z.enum(["admin", "member"]).optional(),
});

export async function GET() {
  try {
    const user = await requireApiUser();
    if (user.role !== "admin") return fail("需要管理员权限", 403);

    const rows = await sql<
      {
        id: string;
        username: string;
        display_name: string;
        role: "admin" | "member";
        disabled: boolean;
        created_at: Date;
        last_login_at: Date | null;
        asset_count: string;
        succeeded_count: string;
      }[]
    >`
      SELECT u.*,
        count(a.id)::text AS asset_count,
        count(a.id) FILTER (WHERE a.status = 'succeeded')::text AS succeeded_count
      FROM users u
      LEFT JOIN assets a ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `;

    return ok({
      items: rows.map((row) => ({
        ...toUser(row),
        assetCount: Number(row.asset_count),
        succeededCount: Number(row.succeeded_count),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireApiUser();
    if (user.role !== "admin") return fail("需要管理员权限", 403);

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message || "参数错误", 400);
    }

    const exists = await sql<{ id: string }[]>`
      SELECT id FROM users WHERE lower(username) = lower(${parsed.data.username}) LIMIT 1
    `;
    if (exists.length) throw new ApiError("用户名已存在", 409);

    const created = await createUser(parsed.data);
    return ok({ user: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
