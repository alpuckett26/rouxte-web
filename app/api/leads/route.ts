import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const carrier    = searchParams.get("carrier");
  const status     = searchParams.get("status") as LeadStatus | null;
  const tags       = searchParams.get("tags")?.split(",").filter(Boolean);
  const isDNK      = searchParams.get("is_do_not_knock");
  const assignedTo = searchParams.get("assigned_to");
  const page       = parseInt(searchParams.get("page") ?? "1");
  const pageSize   = Math.min(parseInt(searchParams.get("page_size") ?? "50"), 2000);

  // `planned` count: Postgres estimates from the query plan instead of a
  // full row count. Orders of magnitude faster on large leads tables —
  // the badge value is approximate, which is fine for UX (we never use
  // the count for math/pagination correctness).
  let query = supabase
    .from("leads")
    .select("*", { count: "planned" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status)     query = query.eq("status", status);
  if (isDNK !== null) query = query.eq("is_do_not_knock", isDNK === "true");
  if (carrier === "att") query = query.eq("carrier_availability->att", true);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, page, page_size: pageSize });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.org_id) return NextResponse.json({ error: "Profile not found — complete onboarding first." }, { status: 400 });

  const body = await request.json();

  const { data, error } = await admin
    .from("leads")
    .insert({
      ...body,
      org_id: profile.org_id,
      created_by: user.id,
      source: body.source ?? "map",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
