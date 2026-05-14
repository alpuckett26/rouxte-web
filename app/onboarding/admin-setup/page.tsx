import AppShell from "@/components/AppShell";
import AdminSetupWizard from "./AdminSetupWizard";

export const metadata = { title: "Set up your org · Rouxte" };

export default function AdminSetupPage() {
  return (
    <AppShell>
      <AdminSetupWizard />
    </AppShell>
  );
}
