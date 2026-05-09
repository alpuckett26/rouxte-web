import ManagerShell from "@/components/manager/ManagerShell";
import SmartPitchDashboard from "@/components/smartpitch/SmartPitchDashboard";
import SmartPitchManagerPanel from "@/components/smartpitch/SmartPitchManagerPanel";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SmartPitchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isManager = false;
  if (user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    isManager = ["admin", "sales_manager", "team_lead"].includes(data?.role ?? "");
  }

  return (
    <ManagerShell>
      {isManager ? <SmartPitchManagerPanel /> : <SmartPitchDashboard />}
    </ManagerShell>
  );
}
