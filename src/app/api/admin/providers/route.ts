import { requireApiUser, ok, fail, handleApiError } from "@/lib/http";
import { listProviderViews } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    if (user.role !== "admin") return fail("需要管理员权限", 403);
    const items = await listProviderViews();
    return ok({ items });
  } catch (error) {
    return handleApiError(error);
  }
}