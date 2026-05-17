import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "@/lib/types";
import ManagerShell from "@/components/manager/ManagerShell";
import TeamLeadPanel from "@/components/manager/TeamLeadPanel";
import ManagerTeamsPanel from "@/components/manager/ManagerTeamsPanel";

export default async function MyTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: UserRole = "team_lead";
  let teamId: string | null = null;
  if (user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select("role, team_id")
      .eq("user_id", user.id)
      .maybeSingle();
    role = (data?.role as UserRole) ?? "team_lead";
    teamId = (data?.team_id as string | null) ?? null;
  }

  // Admins and sales_managers don't belong to a single team — their "My Team"
  // is the all-teams view. Team leads stay on TeamLeadPanel (which shows the
  // orphan state correctly if they're unassigned).
  const showAllTeams = !teamId && (role === "admin" || role === "sales_manager");

  return (
    <ManagerShell>
      {showAllTeams ? <ManagerTeamsPanel /> : <TeamLeadPanel callerRole={role} />}
    </ManagerShell>
  );
}
