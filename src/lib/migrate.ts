import fs from "node:fs/promises";
import path from "node:path";
import { sql } from "./db";
import { env } from "./env";
import { hashPassword } from "./auth";

let schemaPromise: Promise<void> | null = null;

async function applySchema() {
  const schemaPath = path.join(process.cwd(), "src", "lib", "schema.sql");
  const ddl = await fs.readFile(schemaPath, "utf8");
  await sql.unsafe(ddl);

  const countRows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM users
  `;
  const hasUsers = Number(countRows[0]?.count ?? 0) > 0;

  if (!hasUsers && env.admin.password) {
    await sql`
      INSERT INTO users (username, display_name, password_hash, role)
      VALUES (
        ${env.admin.username},
        ${"管理员"},
        ${hashPassword(env.admin.password)},
        'admin'
      )
      ON CONFLICT (username) DO NOTHING
    `;
    console.log(`[db] seeded admin account "${env.admin.username}"`);
  }
}

export function initSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = applySchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
