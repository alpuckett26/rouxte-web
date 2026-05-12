import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const admin = createAdminClient();

  // Fetch the quote + lines + org. The user_profiles join (which includes
  // `phone`, added in migration 028) is NOT embedded here — on prod schemas
  // where the column is missing, the embedded join silently 404'd the whole
  // request. Fetch the rep profile separately and tolerate failures.
  const { data: quote, error } = await admin
    .from("quotes")
    .select("*, quote_lines(*), orgs(name)")
    .eq("id", id)
    .single();
  if (error || !quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort rep profile (full_name always exists; phone/avatar_url may not)
  let user_profiles: { full_name: string | null; phone?: string | null; avatar_url?: string | null } | null = null;
  if (quote.rep_id) {
    // Try the full select first; fall back to bare fields if the column is missing
    const full = await admin
      .from("user_profiles")
      .select("full_name, phone, avatar_url")
      .eq("user_id", quote.rep_id)
      .maybeSingle();
    if (!full.error) {
      user_profiles = full.data ?? null;
    } else {
      const bare = await admin
        .from("user_profiles")
        .select("full_name")
        .eq("user_id", quote.rep_id)
        .maybeSingle();
      user_profiles = bare.data ?? null;
    }
  }

  return NextResponse.json({ quote: { ...quote, user_profiles } });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const body = await request.json();
  const { lines, ...quoteData } = body;

  const { data, error } = await admin
    .from("quotes")
    .update({ ...quoteData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (lines) {
    await admin.from("quote_lines").delete().eq("quote_id", id);
    if (lines.length) {
      await admin.from("quote_lines").insert(
        lines.map((l: Record<string, unknown>) => ({ ...l, quote_id: id }))
      );
    }
  }

  return NextResponse.json({ quote: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("quotes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
