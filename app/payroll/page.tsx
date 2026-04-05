import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppShell from "@/app/components/AppShell";
import PaystubsView from "@/app/components/payroll/PaystubsView";

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Pay</h1>
          <p className="text-sm text-gray-500 mt-1">Your released paystubs from each pay period.</p>
        </div>
        <PaystubsView />
      </div>
    </AppShell>
  );
}
