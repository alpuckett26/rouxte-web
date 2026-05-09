import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import FunnelQuiz from "./FunnelQuiz";

interface Params { params: Promise<{ slug: string }> }

export default async function FunnelPage({ params }: Params) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: funnel } = await admin
    .from("lead_funnels")
    .select("id, rep_id, org_id, active, funnel_name")
    .eq("slug", slug)
    .maybeSingle();

  if (!funnel || !funnel.active) notFound();

  const [profileResult, orgResult] = await Promise.all([
    admin.from("user_profiles").select("full_name, phone").eq("user_id", funnel.rep_id).maybeSingle(),
    admin.from("orgs").select("name").eq("id", funnel.org_id).maybeSingle(),
  ]);

  const repName  = profileResult.data?.full_name ?? "Your Rep";
  const repPhone = profileResult.data?.phone ?? null;
  const orgName  = orgResult.data?.name ?? "";

  // Atomic scan count increment (non-blocking)
  admin.rpc("increment_funnel_scan", { funnel_id: funnel.id }).then(() => {});

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <div className="px-4 py-6 flex flex-col items-center gap-1">
        <div className="text-2xl font-black tracking-tight">
          <span className="text-[#1BAEE1]">ROU</span>
          <span className="text-[#72C41A]">X</span>
          <span className="text-[#1BAEE1]">TE</span>
        </div>
        <p className="text-white/40 text-xs">{repName}{orgName ? ` · ${orgName}` : ""}</p>
      </div>

      <div className="px-4 max-w-sm mx-auto mb-6 text-center">
        <h1 className="text-white text-2xl font-black leading-tight mb-2">
          Check If Your Home Qualifies
        </h1>
        <p className="text-white/50 text-sm">
          Answer a few quick questions to see what offers may be available at your address.
        </p>
      </div>

      <FunnelQuiz slug={slug} repName={repName} repPhone={repPhone} />

      <p className="text-center text-white/20 text-xs pb-8">
        Powered by Rouxte · AT&T Authorized Dealer
      </p>
    </div>
  );
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: funnel } = await admin
    .from("lead_funnels")
    .select("rep_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!funnel) return { title: "Check Your Eligibility | Rouxte" };

  const { data: profile } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("user_id", funnel.rep_id)
    .maybeSingle();

  return {
    title: profile?.full_name
      ? `Check Eligibility with ${profile.full_name} | Rouxte`
      : "Check Your Eligibility | Rouxte",
  };
}
