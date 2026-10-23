import { requireApiUser, ok, handleApiError } from "@/lib/http";
import { listUserProviderViews } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireApiUser();
    return ok({ items: await listUserProviderViews(user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
