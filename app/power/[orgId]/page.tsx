import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import BackupLanding, { BACKUP_META } from "@/app/components/funnel/BackupLanding";

// Org-wide backup power landing page — the URL to put behind Meta / Google ads.
// Leads land unassigned in the org pool and managers are alerted to dispatch them.

interface Params { params: Promise<{ orgId: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrgBackupPage({ params }: Params) {
  const { orgId } = await params;
  if (!UUID.test(orgId)) notFound();

  const { data: org } = await createAdminClient()
    .from("orgs")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) notFound();

  return (
    <BackupLanding
      target={{ orgId: org.id }}
      byline={org.name}
      contactName={org.name || "Our team"}
      contactPhone={null}
      orgName={org.name}
    />
  );
}

export const metadata: Metadata = {
  ...BACKUP_META,
  openGraph: { ...BACKUP_META, type: "website" },
  robots: { index: false },
};
