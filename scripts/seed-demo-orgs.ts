/**
 * Seeds 5 diverse demo orgs with teams, users, subscriptions, comp plans,
 * leads, and 30 days of sales + quote activity. Idempotent — re-running
 * wipes anything with the [DEMO] org-name prefix and reseeds.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/seed-demo-orgs.ts
 *
 * All seeded users get the same password (rouxte-demo) for easy login.
 * Emails are at the .test TLD so they can't collide with real domains.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PREFIX = "[DEMO]";
const DEMO_PASSWORD = "rouxte-demo";

type Role = "admin" | "sales_manager" | "team_lead" | "sales_rep";
type SubStatus = "trialing" | "active" | "past_due";

interface OrgSpec {
  name: string;
  emailDomain: string;
  niche: "fiber" | "wireless" | "both";
  carriers: string[];
  brandColor: string;
  tier: "field" | "pro";
  subStatus: SubStatus;
  trialDaysAgo: number;       // when trial started (0 = today)
  teams: string[];
  members: Array<{ role: Role; count: number }>;
  compPlans: Array<{ carrier: string; product: string; rep: number; mgr: number; lead: number }>;
  activityPerRep: { sales: [number, number]; quotes: [number, number] }; // [min, max]
  failedCharges?: number;
}

const ORG_SPECS: OrgSpec[] = [
  {
    name: "Lectric Fiber Co",
    emailDomain: "demo-fiberco.test",
    niche: "fiber",
    carriers: ["att", "frontier"],
    brandColor: "#2563eb",
    tier: "pro",
    subStatus: "active",
    trialDaysAgo: 45,
    teams: ["North Squad", "South Squad"],
    members: [
      { role: "admin",         count: 1 },
      { role: "sales_manager", count: 1 },
      { role: "team_lead",     count: 2 },
      { role: "sales_rep",     count: 6 },
    ],
    compPlans: [
      { carrier: "AT&T Fiber",      product: "300/300",  rep: 7500,  mgr: 1500, lead: 800 },
      { carrier: "AT&T Fiber",      product: "500/500",  rep: 8500,  mgr: 1700, lead: 900 },
      { carrier: "AT&T Fiber",      product: "1 Gig",    rep: 10000, mgr: 2000, lead: 1000 },
      { carrier: "AT&T Fiber",      product: "2 Gig",    rep: 12500, mgr: 2500, lead: 1250 },
      { carrier: "Frontier Fiber",  product: "500",      rep: 7000,  mgr: 1400, lead: 700 },
      { carrier: "Frontier Fiber",  product: "1 Gig",    rep: 9000,  mgr: 1800, lead: 900 },
    ],
    activityPerRep: { sales: [4, 12], quotes: [10, 25] },
  },
  {
    name: "5G Heroes",
    emailDomain: "demo-5gheroes.test",
    niche: "wireless",
    carriers: ["tmobile", "verizon_5g"],
    brandColor: "#db2777",
    tier: "field",
    subStatus: "trialing",
    trialDaysAgo: 15,
    teams: ["Wireless West"],
    members: [
      { role: "admin",         count: 1 },
      { role: "sales_manager", count: 1 },
      { role: "sales_rep",     count: 4 },
    ],
    compPlans: [
      { carrier: "T-Mobile Home Internet", product: "Standard",   rep: 5000, mgr: 1000, lead: 500 },
      { carrier: "T-Mobile Home Internet", product: "5G Plus",    rep: 6000, mgr: 1200, lead: 600 },
      { carrier: "Verizon 5G Home",        product: "Home",       rep: 5500, mgr: 1100, lead: 550 },
      { carrier: "Verizon 5G Home",        product: "Home Plus",  rep: 6500, mgr: 1300, lead: 650 },
    ],
    activityPerRep: { sales: [2, 8], quotes: [5, 15] },
  },
  {
    name: "Bundle Bros",
    emailDomain: "demo-bundlebros.test",
    niche: "both",
    carriers: ["att", "verizon_5g", "tmobile"],
    brandColor: "#16a34a",
    tier: "pro",
    subStatus: "active",
    trialDaysAgo: 75,
    teams: ["Bundle Team A", "Bundle Team B"],
    members: [
      { role: "admin",         count: 1 },
      { role: "sales_manager", count: 1 },
      { role: "team_lead",     count: 2 },
      { role: "sales_rep",     count: 5 },
    ],
    compPlans: [
      { carrier: "AT&T Fiber",             product: "1 Gig + 5G",  rep: 11000, mgr: 2200, lead: 1100 },
      { carrier: "AT&T Fiber",             product: "2 Gig + 5G",  rep: 13500, mgr: 2700, lead: 1350 },
      { carrier: "T-Mobile Home Internet", product: "Standalone",  rep: 5000,  mgr: 1000, lead: 500 },
      { carrier: "Verizon 5G Home",        product: "Standalone",  rep: 5500,  mgr: 1100, lead: 550 },
    ],
    activityPerRep: { sales: [3, 10], quotes: [8, 20] },
  },
  {
    name: "Solo Saver Co",
    emailDomain: "demo-solosaver.test",
    niche: "fiber",
    carriers: ["att"],
    brandColor: "#d97706",
    tier: "field",
    subStatus: "trialing",
    trialDaysAgo: 2,
    teams: ["Just Me"],
    members: [
      { role: "admin", count: 1 },
    ],
    compPlans: [
      { carrier: "AT&T Fiber", product: "1 Gig", rep: 10000, mgr: 0, lead: 0 },
    ],
    activityPerRep: { sales: [1, 4], quotes: [2, 8] },
  },
  {
    name: "TX Telecom Group",
    emailDomain: "demo-txtelecom.test",
    niche: "both",
    carriers: ["att", "spectrum", "tmobile", "verizon_5g"],
    brandColor: "#111827",
    tier: "pro",
    subStatus: "past_due",
    trialDaysAgo: 90,
    teams: ["Austin Team", "Houston Team", "Dallas Team"],
    members: [
      { role: "admin",         count: 1 },
      { role: "sales_manager", count: 3 },
      { role: "team_lead",     count: 2 },
      { role: "sales_rep",     count: 9 },
    ],
    compPlans: [
      { carrier: "AT&T Fiber",             product: "1 Gig",      rep: 10000, mgr: 2000, lead: 1000 },
      { carrier: "AT&T Fiber",             product: "2 Gig",      rep: 12500, mgr: 2500, lead: 1250 },
      { carrier: "Spectrum",               product: "500",        rep: 6500,  mgr: 1300, lead: 650 },
      { carrier: "Spectrum",               product: "1 Gig",      rep: 8500,  mgr: 1700, lead: 850 },
      { carrier: "T-Mobile Home Internet", product: "5G Plus",    rep: 6000,  mgr: 1200, lead: 600 },
      { carrier: "Verizon 5G Home",        product: "Home Plus",  rep: 6500,  mgr: 1300, lead: 650 },
    ],
    activityPerRep: { sales: [5, 15], quotes: [12, 30] },
    failedCharges: 3,
  },
];

// ── Name generation ──────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Taylor", "Casey", "Morgan", "Riley", "Quinn",
  "Cameron", "Avery", "Hayden", "Skyler", "Parker", "Rowan", "Sage", "Drew",
  "Devon", "Reese", "Jamie", "Kennedy", "Logan", "Charlie", "Robin", "Frankie",
];
const LAST_NAMES = [
  "Carter", "Reed", "Bennett", "Foster", "Hayes", "Ward", "Lane", "Price",
  "Brooks", "Knox", "Pierce", "Walsh", "Stone", "Cole", "Murphy", "Hunt",
  "Bailey", "Hayes", "Morgan", "Ellis", "Tate", "Quinn", "Webb", "Russo",
];

function pickName(seed: number): { first: string; last: string; full: string } {
  const first = FIRST_NAMES[seed % FIRST_NAMES.length];
  const last  = LAST_NAMES[(seed * 7) % LAST_NAMES.length];
  return { first, last, full: `${first} ${last}` };
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomDateInLastDays(days: number): Date {
  const ms = Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

const SPEEDS = [300, 500, 1000, 2000];
const CATEGORIES = ["new", "migration", "mobility", "insurance"] as const;

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function wipeDemoOrgs() {
  console.log("Wiping existing demo orgs...");
  const { data: existing } = await supabase
    .from("orgs")
    .select("id, name")
    .ilike("name", `${DEMO_PREFIX}%`);

  if (!existing?.length) {
    console.log("  no existing demo orgs to wipe.");
    return;
  }

  for (const org of existing) {
    console.log(`  wiping ${org.name}...`);

    // Find all auth users in this org via user_profiles, delete them
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("org_id", org.id);

    for (const p of profiles ?? []) {
      await supabase.auth.admin.deleteUser(p.user_id).catch(() => {});
    }

    // Cascade should clear teams, comp_plans, leads, activity, profiles, subscriptions, billing_charges
    await supabase.from("orgs").delete().eq("id", org.id);
  }
  console.log(`  wiped ${existing.length} org(s).`);
}

// ── Per-org seed ─────────────────────────────────────────────────────────────

async function seedOrg(spec: OrgSpec, nameSeedBase: number): Promise<void> {
  const orgName = `${DEMO_PREFIX} ${spec.name}`;
  console.log(`\nSeeding ${orgName}...`);

  // 1. Create org
  const { data: org, error: orgErr } = await supabase
    .from("orgs")
    .insert({
      name: orgName,
      onboarding_state: {
        shape: spec.members.length === 1 ? "solo" : "team",
        niche: spec.niche,
        primary_carriers: spec.carriers,
        brand_color: spec.brandColor,
      },
      onboarding_completed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (orgErr || !org) throw new Error(`org insert failed: ${orgErr?.message}`);

  // 2. Create teams
  const teamIds: string[] = [];
  for (const teamName of spec.teams) {
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert({ org_id: org.id, name: teamName, tier: 1, benefits: {} })
      .select()
      .single();
    if (teamErr || !team) throw new Error(`team insert failed: ${teamErr?.message}`);
    teamIds.push(team.id);
  }

  // 3. Create users
  let nameSeed = nameSeedBase;
  const users: Array<{ user_id: string; role: Role; team_id: string | null; full_name: string }> = [];

  for (const { role, count } of spec.members) {
    for (let i = 0; i < count; i++) {
      nameSeed++;
      const { first, last, full } = pickName(nameSeed);
      // admins go in no team, others rotate through teams
      const teamId = role === "admin" ? null : teamIds[i % teamIds.length];

      const rolePrefix =
        role === "admin"         ? "admin" :
        role === "sales_manager" ? `manager${i + 1}` :
        role === "team_lead"     ? `lead${i + 1}` :
                                   `rep${i + 1}`;
      const email = `${rolePrefix}@${spec.emailDomain}`.toLowerCase();

      const { data: created, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: full },
      });
      if (authErr || !created.user) {
        console.warn(`  auth user create failed for ${email}: ${authErr?.message}`);
        continue;
      }

      const userId = created.user.id;

      const { error: profErr } = await supabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          org_id: org.id,
          team_id: teamId,
          role,
          full_name: full,
          onboarding_step: "documents",
          onboarding_complete: true,
        });
      if (profErr) {
        console.warn(`  profile insert failed for ${email}: ${profErr.message}`);
        continue;
      }

      users.push({ user_id: userId, role, team_id: teamId, full_name: full });
    }
  }

  console.log(`  created ${users.length} users.`);

  // 4. Subscription
  const trialStart = new Date(Date.now() - spec.trialDaysAgo * 24 * 60 * 60 * 1000);
  const trialEnd   = new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  const periodEnd  = spec.subStatus === "active"
    ? new Date(trialEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
    : spec.subStatus === "past_due"
    ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // overdue by 2 days
    : null;

  const adminUser = users.find((u) => u.role === "admin");

  await supabase.from("org_subscriptions").insert({
    org_id: org.id,
    status: spec.subStatus,
    tier_key: spec.tier,
    trial_started_at: trialStart.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    current_period_end: periodEnd?.toISOString() ?? null,
    square_customer_id: `demo-cust-${org.id.slice(0, 8)}`,
    square_card_id: `demo-card-${org.id.slice(0, 8)}`,
    billing_email: adminUser ? `admin@${spec.emailDomain}` : null,
    billing_name: adminUser?.full_name ?? null,
    created_by: adminUser?.user_id ?? null,
    failed_charge_count: spec.failedCharges ?? 0,
    last_charge_attempt_at: spec.subStatus === "past_due"
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      : null,
  });

  // 5. Comp plans
  if (spec.compPlans.length > 0) {
    await supabase.from("comp_plans").insert(
      spec.compPlans.map((p) => ({
        org_id: org.id,
        carrier: p.carrier,
        product: p.product,
        rep_payout_cents: p.rep,
        manager_override_cents: p.mgr,
        lead_override_cents: p.lead,
      })),
    );
  }

  // 6. Sales + quote activity for each non-admin user
  const activityRows: Array<Record<string, unknown>> = [];
  for (const u of users) {
    if (u.role === "admin" && users.length > 1) continue; // admins in multi-user orgs don't sell here
    const salesCount = rand(spec.activityPerRep.sales[0], spec.activityPerRep.sales[1]);
    const quoteCount = rand(spec.activityPerRep.quotes[0], spec.activityPerRep.quotes[1]);

    for (let i = 0; i < salesCount; i++) {
      const plan = spec.compPlans[i % spec.compPlans.length];
      const speed = SPEEDS[rand(0, SPEEDS.length - 1)];
      const category = CATEGORIES[rand(0, CATEGORIES.length - 1)];
      activityRows.push({
        org_id: org.id,
        actor_id: u.user_id,
        team_id: u.team_id,
        lead_id: null,
        event_type: "sale_submitted",
        summary: `Sale: ${plan.carrier} ${plan.product}`,
        ts: randomDateInLastDays(30).toISOString(),
        metadata: {
          package_category: category,
          speed_mbps: speed,
          wireless_added: Math.random() < 0.35,
          payout_amount: plan.rep / 100,
          commission_amount: (plan.rep / 100) * 0.6,
        },
        is_incident: false,
      });
    }

    for (let i = 0; i < quoteCount; i++) {
      const quoteType = spec.niche === "wireless"
        ? "wireless"
        : spec.niche === "fiber"
        ? "fiber"
        : Math.random() < 0.7 ? "fiber" : "wireless";

      activityRows.push({
        org_id: org.id,
        actor_id: u.user_id,
        team_id: u.team_id,
        lead_id: null,
        event_type: "quote_sent",
        summary: `${quoteType[0].toUpperCase() + quoteType.slice(1)} quote sent`,
        ts: randomDateInLastDays(30).toISOString(),
        metadata: { quote_type: quoteType },
        is_incident: false,
      });
    }
  }

  // Insert activity in chunks of 500
  for (let i = 0; i < activityRows.length; i += 500) {
    const chunk = activityRows.slice(i, i + 500);
    const { error } = await supabase.from("sales_activity_log").insert(chunk);
    if (error) console.warn(`  activity insert chunk failed: ${error.message}`);
  }
  console.log(`  inserted ${activityRows.length} activity rows.`);

  // 7. Past-due → also insert a failed billing_charges row
  if (spec.subStatus === "past_due") {
    await supabase.from("billing_charges").insert({
      org_id: org.id,
      amount_cents: spec.tier === "pro" ? 1999 * users.length : 999 * users.length,
      rep_count: users.length,
      tier_key: spec.tier,
      period_start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      period_end: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
      status: "failed",
      failure_reason: "Card declined (demo)",
    });
  }

  console.log(`  ✓ ${orgName} ready.`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seed: demo orgs");
  console.log("================");
  await wipeDemoOrgs();

  let nameSeed = 0;
  for (const spec of ORG_SPECS) {
    await seedOrg(spec, nameSeed);
    nameSeed += 30;
  }

  console.log("\n✓ Done. Sign in with:");
  console.log("    email:    admin@demo-fiberco.test  (or any role@domain.test)");
  console.log("    password: rouxte-demo");
  console.log("\n  Domains:");
  for (const spec of ORG_SPECS) {
    console.log(`    ${spec.name.padEnd(20)} → admin@${spec.emailDomain}`);
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
