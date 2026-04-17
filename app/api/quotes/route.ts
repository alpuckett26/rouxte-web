import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  let query = admin
    .from("quotes")
    .select("*, quote_lines(*)")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  if (profile.role === "sales_rep") {
    query = query.eq("rep_id", user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quotes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const body = await request.json();
  const { lines, ...quoteData } = body;

  const { data: quote, error } = await admin
    .from("quotes")
    .insert({ ...quoteData, org_id: profile.org_id, rep_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (lines?.length) {
    const { error: linesErr } = await admin.from("quote_lines").insert(
      lines.map((l: Record<string, unknown>) => ({ ...l, quote_id: quote.id }))
    );
    if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 });
  }

  return NextResponse.json({ quote });
}
