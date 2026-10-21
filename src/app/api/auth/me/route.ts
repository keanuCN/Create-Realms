import { getCurrentUser } from "@/lib/auth";
import { ok } from "@/lib/http";
import { hasApiKey, env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return ok({
    user,
    config: {
      appName: env.appName,
      hasApiKey: hasApiKey(),
      mock: env.minimax.mock,
      allowSignup: env.allowSignup,
    },
  });
}
