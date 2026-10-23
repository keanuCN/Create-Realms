import ProviderSettings from "@/components/provider-settings";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PersonalProviderSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ProviderSettings isAdmin={user.role === "admin"} />;
}
