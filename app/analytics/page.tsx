import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import AppShell from "@/components/AppShell";
import AnalyticsClient from "./AnalyticsClient";

export const metadata = { title: "Analytics · Rouxte" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const allowed =
    isSuperAdminEmail(user.email) ||
    profile?.role === "admin" ||
    profile?.role === "sales_manager" ||
    profile?.role === "team_lead";

  if (!allowed) redirect("/dashboard");

  return (
    <AppShell>
      <AnalyticsClient />
    </AppShell>
  );
}
