import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";
import AppShell from "@/components/AppShell";
import AdminOrgsClient from "./AdminOrgsClient";

export const metadata = { title: "Admin · Rouxte" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  if (!isSuperAdminEmail(user.email)) redirect("/dashboard");

  return (
    <AppShell>
      <AdminOrgsClient />
    </AppShell>
  );
}
