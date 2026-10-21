import { requireApiUser, ok, handleApiError } from "@/lib/http";
import { listAssets } from "@/lib/assets";
import type { AssetKind, AssetStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") === "team" ? "team" : "mine";
    const kind = (url.searchParams.get("kind") || "all") as AssetKind | "all";
    const status = (url.searchParams.get("status") || "all") as AssetStatus | "all";
    const favorite = url.searchParams.get("favorite") === "1";
    const q = url.searchParams.get("q") || undefined;
    const limit = Number(url.searchParams.get("limit") || 24);
    const offset = Number(url.searchParams.get("offset") || 0);

    const result = await listAssets({
      userId: user.id,
      role: user.role,
      scope,
      kind,
      status,
      favorite,
      q,
      limit,
      offset,
    });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
