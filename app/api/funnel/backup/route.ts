import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToUser } from "@/lib/push/fcm";
import { geocodeAddress } from "@/lib/geocode";
import {
  FUELS, KEEP, OUTAGES, OWNERSHIP, SOLAR, TIMELINES, WORRIES,
  backupNote, scoreBackup, type BackupAnswers,
} from "@/lib/smartpitch/backup-scoring";

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "referrer"];

// Rep funnel → lead assigned to the rep. Org-wide page → unassigned lead in the
// org pool, attributed to an org admin (leads.created_by is required).
interface Target {
  orgId: string;
  ownerId: string;
  assignTo: string | null;
  funnelId: string | null;
  notify: string[];
}

async function resolveTarget(admin: ReturnType<typeof createAdminClient>, slug: string, orgId: string): Promise<Target | null> {
  if (slug) {
    const { data: funnel } = await admin
      .from("lead_funnels")
      .select("id, rep_id, org_id, active")
      .eq("slug", slug)
      .maybeSingle();
    if (!funnel || !funnel.active) return null;
    return { orgId: funnel.org_id, ownerId: funnel.rep_id, assignTo: funnel.rep_id, funnelId: funnel.id, notify: [funnel.rep_id] };
  }

  if (!UUID.test(orgId)) return null;
  const { data: managers } = await admin
    .from("user_profiles")
    .select("user_id, role")
    .eq("org_id", orgId)
    .in("role", ["admin", "sales_manager"]);
  if (!managers?.length) return null;
  const owner = managers.find((m) => m.role === "admin") ?? managers[0];
  return { orgId, ownerId: owner.user_id, assignTo: null, funnelId: null, notify: managers.map((m) => m.user_id) };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const slug  = str(body?.slug, 80);
  const orgId = str(body?.org_id, 40);
  const raw   = body?.answers ?? {};

  // Honeypot — bots fill every field. Pretend success so they don't retry.
  if (str(raw.company)) return NextResponse.json({ ok: true });

  const keep = Array.isArray(raw.keep) ? raw.keep.filter((k: unknown) => oneOf(KEEP, k)) : [];
  if (
    (!slug && !orgId) ||
    !oneOf(OWNERSHIP, raw.ownership) || !oneOf(WORRIES, raw.worry) || !oneOf(OUTAGES, raw.outage) ||
    !oneOf(FUELS, raw.fuel) || !oneOf(SOLAR, raw.solar) || !oneOf(TIMELINES, raw.timeline)
  ) {
    return NextResponse.json({ error: "Please answer every question." }, { status: 400 });
  }

  const answers: BackupAnswers = {
    ownership: raw.ownership, worry: raw.worry, keep, outage: raw.outage,
    fuel: raw.fuel, solar: raw.solar, timeline: raw.timeline,
    address: str(raw.address), city: str(raw.city, 80), zip: str(raw.zip, 10),
    customer_name: str(raw.customer_name, 120), phone: str(raw.phone, 30),
    email: str(raw.email, 200) || undefined,
    sms_consent: raw.sms_consent === true,
  };

  if (!answers.customer_name || !answers.phone) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  const attribution: Record<string, string> = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = str(body?.attribution?.[k]);
    if (v) attribution[k] = v;
  }

  const admin = createAdminClient();
  const target = await resolveTarget(admin, slug, orgId);
  if (!target) {
    return NextResponse.json({ error: "Funnel not found" }, { status: 404 });
  }

  const scored = scoreBackup(answers);
  const { score, temperature, recommended_pitch, teaser } = scored;

  const street = [answers.address, answers.city, answers.zip].filter(Boolean).join(", ");
  const address = street || `${answers.customer_name} (Backup power)`;
  // Unassigned org leads are dispatched from the map — give them coords.
  const coords = street ? await geocodeAddress(street) : null;

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .insert({
      org_id:               target.orgId,
      created_by:           target.ownerId,
      assigned_to:          target.assignTo,
      assigned_at:          target.assignTo ? new Date().toISOString() : null,
      address,
      lat:                  coords?.lat ?? null,
      lng:                  coords?.lng ?? null,
      customer_name:        answers.customer_name,
      phone:                answers.phone,
      source:               "backup_power",
      status:               "new",
      carrier_availability: {},
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    console.error("[backup-funnel] lead insert failed:", leadError?.message);
    return NextResponse.json({ error: "Failed to save your request" }, { status: 500 });
  }
  const leadId: string = lead.id;

  const adLines = Object.entries(attribution).map(([k, v]) => `${k}: ${v}`);
  const { error: noteError } = await admin.from("lead_notes").insert({
    lead_id:   leadId,
    author_id: target.ownerId,
    body:      [backupNote(answers, scored), ...(adLines.length ? ["", "Ad attribution", ...adLines] : [])].join("\n"),
  });
  if (noteError) console.error("[backup-funnel] note insert failed:", noteError.message);

  // Rep funnels also feed the SmartPitch dashboard (funnel_submissions needs a funnel + rep).
  if (target.funnelId && target.assignTo) {
    const { error: subError } = await admin.from("funnel_submissions").insert({
      funnel_id:         target.funnelId,
      rep_id:            target.assignTo,
      org_id:            target.orgId,
      lead_id:           leadId,
      service_interest:  "backup_power",
      pain_point:        answers.worry,
      switch_timeline:   answers.timeline,
      customer_name:     answers.customer_name,
      phone:             answers.phone,
      email:             answers.email ?? null,
      address:           answers.address,
      city:              answers.city,
      zip:               answers.zip,
      sms_consent:       answers.sms_consent,
      lead_score:        score,
      lead_temperature:  temperature,
      recommended_pitch,
      source:            "backup_power",
    });
    if (subError) console.error("[backup-funnel] submission insert failed:", subError.message);
  }

  const title = target.assignTo ? "New backup power lead!" : "New backup power lead to assign";
  const text  = `${answers.customer_name} wants backup power — ${temperature.toUpperCase()} lead (${score}/100)`;
  const data  = { lead_id: leadId, score, temperature, funnel_id: target.funnelId };

  admin.from("notifications").insert(target.notify.map((userId) => ({
    user_id: userId,
    org_id:  target.orgId,
    type:    "smartpitch_lead",
    title,
    body:    text,
    data,
  }))).then(({ error }) => {
    if (error) console.error("[backup-funnel] notify failed:", error.message);
  });

  for (const userId of target.notify) {
    pushToUser(
      userId,
      { title, body: text, data: { type: "smartpitch_lead", ...data } },
      { orgId: target.orgId, prefKey: "push_smartpitch_lead" },
    ).catch((e) => console.error("[backup-funnel] push failed:", e));
  }

  // event_id lets the ad pixels and a future server-side conversions feed dedupe.
  return NextResponse.json({ ok: true, temperature, teaser, event_id: leadId });
}
