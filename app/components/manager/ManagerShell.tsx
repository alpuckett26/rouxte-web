import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "@/lib/types";
import AppShell from "@/components/AppShell";
import ManagerSubNav from "@/components/manager/ManagerSubNav";

export default async function ManagerShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: UserRole = "sales_rep";
  if (user) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    role = (data?.role as UserRole) ?? "sales_rep";
  }

  return (
    <AppShell>
      <ManagerSubNav role={role} />
      {children}
    </AppShell>
  );
}
