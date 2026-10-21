import Studio from "@/components/studio/studio";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  return <Studio displayName={user?.displayName || user?.username || "朋友"} />;
}
