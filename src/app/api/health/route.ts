import { sql } from "@/lib/db";
import { env, hasApiKey } from "@/lib/env";
import { ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, unknown> = {
    app: env.appName,
    mock: env.minimax.mock,
    hasApiKey: hasApiKey(),
    db: false,
    worker: { alive: false, updatedAt: null, ageSeconds: null },
  };

  try {
    await sql`SELECT 1`;
    result.db = true;

    const rows = await sql<{ updated_at: Date }[]>`
      SELECT updated_at FROM system_status WHERE key = 'worker' LIMIT 1
    `;
    if (rows[0]) {
      const age = Math.round((Date.now() - rows[0].updated_at.getTime()) / 1000);
      result.worker = {
        alive: age < 30,
        updatedAt: rows[0].updated_at.toISOString(),
        ageSeconds: age,
      };
    }
  } catch {
    result.db = false;
  }

  return ok(result);
}
