import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { fiberQuoteEmail } from "@/lib/email/templates";
import { FIBER_PLANS } from "@/lib/quoting/fiber-pricing";

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

  // Fetch core profile fields that are guaranteed to exist
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, full_name").eq("user_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  // Phone added in migration 028 — fetch separately so a missing column doesn't
  // break the whole quote save flow
  const { data: profileExt } = await admin
    .from("user_profiles").select("phone").eq("user_id", user.id).maybeSingle();

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

  // ── Fiber quote post-actions ───────────────────────────────────────────────
  if (quote.quote_type === "fiber" && quote.customer_email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const quoteUrl = `${appUrl}/quote/${quote.id}`;
    const fiberPlan = FIBER_PLANS.find(p => p.id === quote.fiber_plan);
    const repName  = profile.full_name ?? "Your Rep";
    const repPhone = (profileExt as { phone?: string } | null)?.phone ?? undefined;
    const repEmail = user.email ?? undefined;

    const { data: org } = await admin
      .from("orgs").select("name").eq("id", profile.org_id).maybeSingle();
    const orgName = org?.name ?? "Rouxte";

    const { subject, html, text } = fiberQuoteEmail({
      customerName: quote.customer_name ?? "",
      repName,
      repPhone,
      repEmail,
      orgName,
      planLabel: fiberPlan?.label  ?? quote.fiber_plan ?? "Fiber Internet",
      planSpeed: fiberPlan?.speed  ?? "",
      monthly:   quote.monthly_total,
      quoteUrl,
      promoNote: quote.promo_note ?? undefined,
    });
    await sendEmail({ from: FROM, to: quote.customer_email, subject, html, text });

    await admin.from("leads").insert({
      org_id:               profile.org_id,
      created_by:           user.id,
      assigned_to:          user.id,
      assigned_at:          new Date().toISOString(),
      address:              quote.customer_name
        ? `${quote.customer_name} (Fiber Quote)`
        : "Fiber Quote Lead",
      customer_name:        quote.customer_name ?? null,
      phone:                null,
      source:               "quote",
      status:               "new",
      carrier_availability: {},
    });
  }

  return NextResponse.json({ quote });
}
