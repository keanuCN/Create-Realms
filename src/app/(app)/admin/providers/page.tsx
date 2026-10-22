import { redirect } from "next/navigation";
import ProviderSettings from "@/components/provider-settings";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProviderSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <ProviderSettings />;
}