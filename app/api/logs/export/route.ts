import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lead_id = searchParams.get("lead_id");

  let query = supabase
    .from("sales_activity_log")
    .select(`
      id, event_type, summary, metadata, is_incident, ts, amends_log_id,
      signoffs:sales_activity_signoffs(action, note, ts),
      attachments:sales_activity_attachments(file_url, file_type, label, ts)
    `)
    .order("ts", { ascending: true });

  if (lead_id) query = query.eq("lead_id", lead_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // v1: return JSON (v2 will add PDF/CSV)
  const filename = lead_id ? `rouxte-case-packet-${lead_id}.json` : "rouxte-activity-export.json";

  return new NextResponse(JSON.stringify({ exported_at: new Date().toISOString(), entries: data }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
