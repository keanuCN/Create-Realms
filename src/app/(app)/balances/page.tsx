import { redirect } from "next/navigation";
import AccountBalances from "@/components/account-balances";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountBalancesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AccountBalances />;
}
