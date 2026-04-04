import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "@/lib/types";
import ManagerShell from "@/components/manager/ManagerShell";
import TeamLeadPanel from "@/components/manager/TeamLeadPanel";

export default async function MyTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: UserRole = "team_lead";
  if (user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    role = (data?.role as UserRole) ?? "team_lead";
  }

  return (
    <ManagerShell>
      <TeamLeadPanel callerRole={role} />
    </ManagerShell>
  );
}
