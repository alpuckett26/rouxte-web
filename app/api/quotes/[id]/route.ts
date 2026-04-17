import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("quotes")
    .select("*, quote_lines(*), orgs(name), user_profiles!rep_id(full_name, phone, avatar_url)")
    .eq("id", id)
    .single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ quote: data });
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
