import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { ok } from "@/lib/http";
import { listProviderViews } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result: Record<string, unknown> = {
    app: env.appName,
    mock: env.minimax.mock,
    hasApiKey: false,
    providers: [] as { id: string; configured: boolean; enabled: boolean; source: string }[],
    db: false,
    worker: { alive: false, updatedAt: null, ageSeconds: null },
  };

  try {
    await sql`SELECT 1`;
    result.db = true;

    const providers = await listProviderViews();
    result.providers = providers.map((item) => ({
      id: item.id,
      configured: item.configured,
      enabled: item.enabled,
      source: item.source,
    }));
    result.hasApiKey = providers.some((item) => item.id === "minimax" && item.configured);

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
