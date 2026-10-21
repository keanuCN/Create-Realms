import { cookies } from "next/headers";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "./db";
import { env } from "./env";
import { hashPassword, verifyPassword } from "./password";
import type { User } from "./types";

export { hashPassword, verifyPassword };

export const SESSION_COOKIE = "aigc_session";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + env.sessionDays * 86_400_000);
  await sql`
    INSERT INTO sessions (user_id, token_hash, user_agent, expires_at)
    VALUES (${userId}, ${sha256(token)}, ${userAgent ?? null}, ${expires})
  `;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // LAN over plain HTTP
    path: "/",
    expires,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await sql`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
  }
  store.delete(SESSION_COOKIE);
}

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "member";
  disabled: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    disabled: row.disabled,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const rows = await sql<UserRow[]>`
      SELECT u.* FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ${sha256(token)}
        AND s.expires_at > now()
        AND u.disabled = false
      LIMIT 1
    `;
    return rows[0] ? toUser(rows[0]) : null;
  } catch {
    return null;
  }
});

export async function findUserByCredentials(username: string, password: string) {
  const rows = await sql<(UserRow & { password_hash: string })[]>`
    SELECT * FROM users WHERE lower(username) = lower(${username}) LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.disabled) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return row;
}

export async function createUser(input: {
  username: string;
  displayName?: string;
  password: string;
  role?: "admin" | "member";
}) {
  const rows = await sql<UserRow[]>`
    INSERT INTO users (username, display_name, password_hash, role)
    VALUES (
      ${input.username.trim()},
      ${input.displayName?.trim() || input.username.trim()},
      ${hashPassword(input.password)},
      ${input.role ?? "member"}
    )
    RETURNING *
  `;
  return toUser(rows[0]);
}

export { toUser };
export type { UserRow };
