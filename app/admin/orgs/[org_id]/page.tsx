import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import AppShell from "@/components/AppShell";
import AdminOrgDetailClient from "./AdminOrgDetailClient";

export const metadata = { title: "Org · Admin · Rouxte" };

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ org_id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  if (!isSuperAdminEmail(user.email)) redirect("/dashboard");

  const { org_id } = await params;

  return (
    <AppShell>
      <AdminOrgDetailClient orgId={org_id} />
    </AppShell>
  );
}
