import { redirect } from "next/navigation";
import AdminUsers from "@/components/admin-users";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <AdminUsers me={user} />;
}
