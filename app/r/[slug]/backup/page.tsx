import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import BackupLanding, { BACKUP_META } from "@/app/components/funnel/BackupLanding";

interface Params { params: Promise<{ slug: string }> }

export default async function RepBackupPage({ params }: Params) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: funnel } = await admin
    .from("lead_funnels")
    .select("id, rep_id, org_id, active")
    .eq("slug", slug)
    .maybeSingle();
  if (!funnel || !funnel.active) notFound();

  const [profileResult, orgResult] = await Promise.all([
    admin.from("user_profiles").select("full_name, phone").eq("user_id", funnel.rep_id).maybeSingle(),
    admin.from("orgs").select("name").eq("id", funnel.org_id).maybeSingle(),
  ]);

  const repName = profileResult.data?.full_name ?? "Your Rep";
  const orgName = orgResult.data?.name ?? "";

  // Atomic scan count increment (non-blocking)
  admin.rpc("increment_funnel_scan", { funnel_id: funnel.id }).then(() => {});

  return (
    <BackupLanding
      target={{ slug }}
      byline={`${repName}${orgName ? ` · ${orgName}` : ""}`}
      contactName={repName}
      contactPhone={profileResult.data?.phone ?? null}
      orgName={orgName}
    />
  );
}

export const metadata: Metadata = {
  ...BACKUP_META,
  openGraph: { ...BACKUP_META, type: "website" },
  robots: { index: false },
};
