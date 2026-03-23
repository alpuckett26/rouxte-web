import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SignoffAction } from "@/lib/types";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  if (!["admin", "sales_manager", "team_lead"].includes(profile.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { action, note } = (await request.json()) as { action: SignoffAction; note?: string };

  if (!["acknowledged", "approved", "denied"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sales_activity_signoffs")
    .insert({
      log_id: id,
      org_id: profile.org_id,
      manager_id: user.id,
      action,
      note: note ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also log the signoff action itself
  await supabase.from("sales_activity_log").insert({
    org_id: profile.org_id,
    actor_id: user.id,
    event_type: action === "acknowledged"
      ? "manager_acknowledged"
      : action === "approved"
      ? "manager_approved"
      : "manager_denied",
    summary: note ?? `Manager ${action} incident`,
    metadata: { original_log_id: id },
    is_incident: false,
  });

  return NextResponse.json({ data }, { status: 201 });
}
