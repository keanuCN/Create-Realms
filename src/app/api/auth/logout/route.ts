import { destroySession } from "@/lib/auth";
import { ok } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  await destroySession();
  return ok({ ok: true });
}
