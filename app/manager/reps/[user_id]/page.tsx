import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canViewerSeeUser } from "@/lib/auth/lead-scope";
import AppShell from "@/components/AppShell";
import RepDrillDownClient from "./RepDrillDownClient";

export const metadata = { title: "Rep · Rouxte" };

export default async function RepDrillDownPage({
  params,
}: {
  params: Promise<{ user_id: string }>;
}) {
  const { user_id: targetUserId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const admin = createAdminClient();
  const { data: viewerProfile } = await admin
    .from("user_profiles")
    .select("user_id, org_id, team_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!viewerProfile) redirect("/dashboard");

  const allowed = await canViewerSeeUser(
    admin,
    { ...viewerProfile, email: user.email ?? null },
    targetUserId,
  );
  if (!allowed) redirect("/dashboard");

  return (
    <AppShell>
      <RepDrillDownClient targetUserId={targetUserId} />
    </AppShell>
  );
}
