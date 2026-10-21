import { initSchema } from "../src/lib/migrate";
import { sql } from "../src/lib/db";

async function main() {
  await initSchema();
  console.log("[db] schema ready");
  await sql.end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error("[db] migration failed", error);
  process.exitCode = 1;
  await sql.end({ timeout: 3 }).catch(() => {});
});
