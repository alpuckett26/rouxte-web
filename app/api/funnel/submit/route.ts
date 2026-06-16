import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreQuiz, QuizAnswers } from "@/lib/smartpitch/scoring";
import { pushToUser } from "@/lib/push/fcm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, answers } = body as { slug: string; answers: QuizAnswers };

  if (!slug || !answers?.customer_name?.trim() || !answers?.phone?.trim()) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Validate funnel
  const { data: funnel } = await admin
    .from("lead_funnels")
    .select("id, rep_id, org_id, active")
    .eq("slug", slug)
    .maybeSingle();

  if (!funnel || !funnel.active) {
    return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
  }

  const { score, temperature, recommended_pitch } = scoreQuiz(answers);

  const address =
    [answers.address, answers.city, answers.state_abbr, answers.zip]
      .filter(Boolean)
      .join(", ") || `${answers.customer_name} (SmartPitch)`;

  // Create lead
  const { data: lead } = await admin
    .from("leads")
    .insert({
      org_id:               funnel.org_id,
      created_by:           funnel.rep_id,
      assigned_to:          funnel.rep_id,
      assigned_at:          new Date().toISOString(),
      address,
      customer_name:        answers.customer_name.trim(),
      phone:                answers.phone.trim(),
      source:               "smartpitch",
      status:               "new",
      carrier_availability: {},
    })
    .select("id")
    .single();

  const leadId = lead?.id ?? null;

  // Create submission
  const { error: subError } = await admin.from("funnel_submissions").insert({
    funnel_id:         funnel.id,
    rep_id:            funnel.rep_id,
    org_id:            funnel.org_id,
    lead_id:           leadId,
    service_interest:  answers.service_interest,
    current_provider:  answers.current_provider,
    pain_point:        answers.pain_point,
    monthly_bill:      answers.monthly_bill,
    switch_timeline:   answers.switch_timeline,
    customer_name:     answers.customer_name.trim(),
    phone:             answers.phone.trim(),
    email:             answers.email?.trim() || null,
    address:           answers.address,
    city:              answers.city,
    state_abbr:        answers.state_abbr || null,
    zip:               answers.zip,
    sms_consent:       answers.sms_consent ?? false,
    lead_score:        score,
    lead_temperature:  temperature,
    recommended_pitch,
    source:            "smartpitch",
  });

  if (subError) {
    console.error("[smartpitch] submission insert failed:", subError.message);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }

  // Notify rep (fire and forget)
  admin.from("notifications").insert({
    user_id: funnel.rep_id,
    org_id:  funnel.org_id,
    type:    "smartpitch_lead",
    title:   "New SmartPitch lead!",
    body:    `${answers.customer_name.trim()} submitted your funnel — ${temperature.toUpperCase()} lead (${score}/100)`,
    data:    { lead_id: leadId, score, temperature, funnel_id: funnel.id },
  }).then(({ error }) => {
    if (error) console.error("[smartpitch] notify failed:", error.message);
  });

  // Push notification (fire-and-forget — non-fatal, no-op if FCM unconfigured).
  // Gated on notification_prefs.push_smartpitch_lead (opt-out, default on).
  pushToUser(
    funnel.rep_id,
    {
      title: "New SmartPitch lead!",
      body:  `${answers.customer_name.trim()} submitted your funnel — ${temperature.toUpperCase()} lead (${score}/100)`,
      data:  { type: "smartpitch_lead", lead_id: leadId, score, temperature, funnel_id: funnel.id },
    },
    { orgId: funnel.org_id, prefKey: "push_smartpitch_lead" },
  ).catch((e) => console.error("[smartpitch] push failed:", e));

  return NextResponse.json({ ok: true, score, temperature });
}
