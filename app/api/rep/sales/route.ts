import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Fetch all sale_submitted events for this rep with signoffs
  const { data: logs } = await admin
    .from("sales_activity_log")
    .select("id, created_at, lead_id, summary, metadata, signoffs:sales_activity_signoffs(action, note, ts)")
    .eq("user_id", user.id)
    .eq("event_type", "sale_submitted")
    .order("created_at", { ascending: false })
    .limit(20);

  const allLogs = logs ?? [];

  // Enrich with lead addresses
  const leadIds = [...new Set(allLogs.map((l) => l.lead_id).filter(Boolean))];
  const { data: leads } = leadIds.length
    ? await admin.from("leads").select("id, address, customer_name").in("id", leadIds)
    : { data: [] };

  const leadMap: Record<string, { address: string; customer_name: string | null }> = {};
  for (const l of leads ?? []) leadMap[l.id] = { address: l.address, customer_name: l.customer_name };

  const enriched = allLogs.map((log) => {
    const signoffs = log.signoffs ?? [];
    const isVerified = signoffs.some((s: { action: string }) => s.action === "approved");
    const isRejected = signoffs.some((s: { action: string }) => s.action === "denied");
    return {
      ...log,
      lead_address: log.lead_id ? leadMap[log.lead_id]?.address ?? null : null,
      customer_name: log.lead_id ? leadMap[log.lead_id]?.customer_name ?? null : null,
      status: isVerified ? "verified" : isRejected ? "rejected" : "pending",
      signoff_note: signoffs[0]?.note ?? null,
    };
  });

  // Recent activity (last 10 events for this rep, any type)
  const { data: activity } = await admin
    .from("sales_activity_log")
    .select("id, event_type, summary, created_at, lead_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    sales: enriched,
    activity: activity ?? [],
  });
}
