import AppShell from "@/components/AppShell";
import BillingClient from "./BillingClient";

export const metadata = { title: "Billing · Rouxte" };

export default function BillingPage() {
  return (
    <AppShell>
      <BillingClient />
    </AppShell>
  );
}
