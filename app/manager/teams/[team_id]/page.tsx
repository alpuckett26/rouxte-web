import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "@/lib/types";
import ManagerShell from "@/components/manager/ManagerShell";
import TeamLeadPanel from "@/components/manager/TeamLeadPanel";

export default async function TeamDrillDownPage({
  params,
}: {
  params: Promise<{ team_id: string }>;
}) {
  const { team_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole) ?? "team_lead";
  if (role !== "admin" && role !== "sales_manager") {
    redirect("/manager/team");
  }

  return (
    <ManagerShell>
      <TeamLeadPanel callerRole={role} teamIdOverride={team_id} />
    </ManagerShell>
  );
}
