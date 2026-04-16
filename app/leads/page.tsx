import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import LeadsListPage from "@/components/leads/LeadsListPage";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.role === "admin" || profile?.role === "sales_manager") {
      redirect("/manager/leads");
    }
  }

  return (
    <AppShell>
      <LeadsListPage />
    </AppShell>
  );
}
