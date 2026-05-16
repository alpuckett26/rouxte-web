import AppShell from "@/components/AppShell";
import LeadsListPage from "@/components/leads/LeadsListPage";

export default async function LeadsPage() {
  // No more role redirect — managers see the same /leads URL with
  // manager-aware columns + bulk-assign bar handled inside LeadsListPage.
  // /manager/leads still exists as the analytics tracker, linked from
  // the manager nav.
  return (
    <AppShell>
      <LeadsListPage />
    </AppShell>
  );
}
