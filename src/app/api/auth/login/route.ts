import { z } from "zod";
import { createSession, findUserByCredentials, toUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  username: z.string().trim().min(1, "请输入用户名").max(64),
  password: z.string().min(1, "请输入密码").max(128),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "参数错误", 400);
  }

  const { username, password } = parsed.data;
  const row = await findUserByCredentials(username, password);
  if (!row) {
    return fail("用户名或密码错误", 401);
  }

  await createSession(row.id, req.headers.get("user-agent"));
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${row.id}`;

  return ok({ user: toUser(row) });
}
