import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch sale_submitted events that have no verification signoff yet
  const { data: logs } = await admin
    .from("sales_activity_log")
    .select("*, signoffs:sales_activity_signoffs(*)")
    .eq("org_id", profile.org_id)
    .eq("event_type", "sale_submitted")
    .order("created_at", { ascending: false });

  // Pending = no signoff of type sale_verified or sale_rejected
  const pending = (logs ?? []).filter((log) => {
    const signoffs = log.signoffs ?? [];
    return !signoffs.some((s: { action: string }) =>
      s.action === "sale_verified" || s.action === "sale_rejected"
    );
  });

  const verified = (logs ?? []).filter((log) => {
    const signoffs = log.signoffs ?? [];
    return signoffs.some((s: { action: string }) => s.action === "sale_verified");
  });

  const rejected = (logs ?? []).filter((log) => {
    const signoffs = log.signoffs ?? [];
    return signoffs.some((s: { action: string }) => s.action === "sale_rejected");
  });

  // Enrich with rep names and lead addresses
  const userIds  = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))];
  const leadIds  = [...new Set((logs ?? []).map((l) => l.lead_id).filter(Boolean))];

  const [{ data: profiles }, { data: leads }] = await Promise.all([
    userIds.length ? admin.from("user_profiles").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] }),
    leadIds.length ? admin.from("leads").select("id, address, customer_name").in("id", leadIds) : Promise.resolve({ data: [] }),
  ]);

  const nameMap: Record<string, string> = {};
  for (const p of profiles ?? []) nameMap[p.user_id] = p.full_name;

  const leadMap: Record<string, { address: string; customer_name: string | null }> = {};
  for (const l of leads ?? []) leadMap[l.id] = { address: l.address, customer_name: l.customer_name };

  const enrich = (arr: typeof logs) => (arr ?? []).map((log) => ({
    ...log,
    rep_name: nameMap[log.user_id] ?? "Unknown",
    lead_address: log.lead_id ? leadMap[log.lead_id]?.address ?? null : null,
    customer_name: log.lead_id ? leadMap[log.lead_id]?.customer_name ?? null : null,
  }));

  return NextResponse.json({
    pending: enrich(pending),
    verified: enrich(verified),
    rejected: enrich(rejected),
  });
}
