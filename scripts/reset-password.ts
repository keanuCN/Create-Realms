import { sql } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("用法: pnpm reset-password <用户名> <新密码>");
    process.exitCode = 1;
    return;
  }
  if (password.length < 6) {
    console.error("密码至少 6 位");
    process.exitCode = 1;
    return;
  }

  const rows = await sql`
    UPDATE users SET password_hash = ${hashPassword(password)}, disabled = false
    WHERE lower(username) = lower(${username})
    RETURNING id, username
  `;
  if (!rows.length) {
    console.error(`用户 "${username}" 不存在`);
    process.exitCode = 1;
    return;
  }

  await sql`DELETE FROM sessions WHERE user_id = ${rows[0].id}`;
  console.log(`已重置 ${rows[0].username} 的密码`);
  await sql.end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error("[reset-password] failed", error);
  process.exitCode = 1;
  await sql.end({ timeout: 3 }).catch(() => {});
});
