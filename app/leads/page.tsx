import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import LeadsListPage from "@/components/leads/LeadsListPage";

export default function LeadsPage() {
  // No more role redirect — managers see the same /leads URL with
  // manager-aware columns + bulk-assign bar handled inside LeadsListPage.
  // /manager/leads still exists as the analytics tracker, linked from
  // the manager nav.
  // Suspense boundary required because LeadsListPage uses useSearchParams().
  return (
    <AppShell>
      <Suspense fallback={<div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />}>
        <LeadsListPage />
      </Suspense>
    </AppShell>
  );
}
