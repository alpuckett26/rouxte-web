import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
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

  const { action, note } = (await request.json()) as {
    action: "sale_verified" | "sale_rejected";
    note?: string;
  };

  if (action !== "sale_verified" && action !== "sale_rejected") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Fetch the original sale_submitted log to get lead_id, user_id, metadata
  const { data: log, error: logErr } = await admin
    .from("sales_activity_log")
    .select("id, lead_id, user_id, metadata, org_id")
    .eq("id", id)
    .eq("event_type", "sale_submitted")
    .maybeSingle();

  if (logErr || !log) {
    return NextResponse.json({ error: "Sale log not found" }, { status: 404 });
  }

  // Write signoff record
  const { error: signoffErr } = await admin
    .from("sales_activity_signoffs")
    .insert({
      log_id: id,
      org_id: profile.org_id,
      manager_id: user.id,
      action: action === "sale_verified" ? "approved" : "denied",
      note: note ?? null,
    });

  if (signoffErr) {
    return NextResponse.json({ error: signoffErr.message }, { status: 500 });
  }

  // Log the verification event
  await admin.from("sales_activity_log").insert({
    org_id: profile.org_id,
    lead_id: log.lead_id,
    actor_id: user.id,
    event_type: action,
    summary: action === "sale_verified"
      ? `Sale verified by manager${note ? `: ${note}` : ""}`
      : `Sale rejected by manager${note ? `: ${note}` : ""}`,
    metadata: { original_log_id: id },
    is_incident: false,
  });

  // Update lead status: verified → "sold", rejected → "lost"
  if (log.lead_id) {
    await admin.from("leads")
      .update({ status: action === "sale_verified" ? "sold" : "lost" })
      .eq("id", log.lead_id);
  }

  return NextResponse.json({ ok: true });
}
