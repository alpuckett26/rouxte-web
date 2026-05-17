/**
 * Seeds one large "seasoned" demo org: [DEMO PRO] Rouxte Showcase.
 *
 *   1 admin + 2 sales_managers + 4 team_leads + 36 sales_reps
 *   4 teams (mixed sizes: 11 / 9 / 9 / 7)
 *   ~2000 leads geo-distributed across Austin / Houston / Atlanta / New Orleans
 *   ~30k+ sales_activity_log rows over 90 days — every LogEventType represented
 *   Quotes, training progress, sales goals, notifications, comp plans
 *   Active "pro"-tier subscription
 *
 * Idempotent: wipes anything matching `[DEMO PRO] %` and recreates. Does NOT
 * touch the smaller `[DEMO]` orgs from seed-demo-orgs.ts.
 *
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/seed-demo-pro-org.ts
 *
 * Sign in with:
 *   email:    demo-admin@rouxte-pro.test
 *   password: rouxte-demo
 */

import { createClient } from "@supabase/supabase-js";
import {
  DEMO_PASSWORD,
  pickName,
  rand,
  randomDateInLastDays,
  pick,
  weighted,
  wipeOrgsByPrefix,
  cleanupAuthUsersByEmailDomain,
} from "./lib/seed-helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PRO_PREFIX = "[DEMO PRO]";
const ORG_NAME = `${PRO_PREFIX} Rouxte Showcase`;
const EMAIL_DOMAIN = "rouxte-pro.test";
const ADMIN_EMAIL = `demo-admin@${EMAIL_DOMAIN}`;

type Role = "admin" | "sales_manager" | "team_lead" | "sales_rep";
type LeadStatus = "new" | "attempted" | "interested" | "appointment" | "sold" | "lost";
type TeamKey = "alpha" | "bravo" | "charlie" | "delta";

interface SeededUser {
  user_id: string;
  email: string;
  role: Role;
  team_key: TeamKey | null;
  team_id: string | null;
  full_name: string;
  managed_teams?: TeamKey[];
}

// ── Team specs ───────────────────────────────────────────────────────────────

const TEAMS: Array<{
  key: TeamKey;
  display: string;
  rep_count: number;
  // sales per rep over 90d — defines the team's "strength"
  sales_range: [number, number];
}> = [
  { key: "alpha",   display: "Alpha (top performers)",  rep_count: 11, sales_range: [20, 30] },
  { key: "bravo",   display: "Bravo (steady)",          rep_count: 9,  sales_range: [12, 18] },
  { key: "charlie", display: "Charlie (mid-pack)",      rep_count: 9,  sales_range: [8, 14] },
  { key: "delta",   display: "Delta (rebuilding)",      rep_count: 7,  sales_range: [4, 8] },
];

// ── Geography ────────────────────────────────────────────────────────────────

const CITIES: Array<{
  name: string;
  state: string;
  lat: number;
  lng: number;
  weight: number;
  streets: string[];
  zips: string[];
}> = [
  {
    name: "Austin", state: "TX", lat: 30.27, lng: -97.74, weight: 30,
    streets: ["Congress Ave", "Lamar Blvd", "Burnet Rd", "Anderson Ln", "Slaughter Ln", "Cesar Chavez St"],
    zips: ["78701", "78704", "78745", "78758", "78759"],
  },
  {
    name: "Houston", state: "TX", lat: 29.76, lng: -95.37, weight: 30,
    streets: ["Westheimer Rd", "Memorial Dr", "Bellaire Blvd", "Bissonnet St", "Kirby Dr", "Shepherd Dr"],
    zips: ["77002", "77006", "77019", "77024", "77056"],
  },
  {
    name: "Atlanta", state: "GA", lat: 33.75, lng: -84.39, weight: 25,
    streets: ["Peachtree St", "Ponce de Leon Ave", "Highland Ave", "North Ave", "Memorial Dr"],
    zips: ["30309", "30307", "30316", "30324", "30342"],
  },
  {
    name: "New Orleans", state: "LA", lat: 29.95, lng: -90.07, weight: 15,
    streets: ["Magazine St", "St Charles Ave", "Canal St", "Esplanade Ave", "Tchoupitoulas St"],
    zips: ["70112", "70115", "70116", "70118", "70130"],
  },
];

function pickCity(): typeof CITIES[number] {
  return weighted(CITIES.map((c) => [c, c.weight] as [typeof c, number]));
}

function jitter(center: number, range = 0.08): number {
  return center + (Math.random() - 0.5) * 2 * range;
}

function makeLeadAddress(city: typeof CITIES[number]): { address: string; lat: number; lng: number } {
  const num = rand(100, 9999);
  const street = pick(city.streets);
  const zip = pick(city.zips);
  return {
    address: `${num} ${street}, ${city.name} ${city.state} ${zip}`,
    lat: jitter(city.lat),
    lng: jitter(city.lng),
  };
}

// ── Comp plans ───────────────────────────────────────────────────────────────

const COMP_PLANS = [
  { carrier: "AT&T Fiber",             product: "300/300",     rep: 7500,  mgr: 1500, lead: 800  },
  { carrier: "AT&T Fiber",             product: "500/500",     rep: 8500,  mgr: 1700, lead: 900  },
  { carrier: "AT&T Fiber",             product: "1 Gig",       rep: 10000, mgr: 2000, lead: 1000 },
  { carrier: "AT&T Fiber",             product: "2 Gig",       rep: 12500, mgr: 2500, lead: 1250 },
  { carrier: "AT&T Fiber",             product: "5 Gig",       rep: 15000, mgr: 3000, lead: 1500 },
  { carrier: "T-Mobile Home Internet", product: "Standard",    rep: 5000,  mgr: 1000, lead: 500  },
  { carrier: "T-Mobile Home Internet", product: "5G Plus",     rep: 6000,  mgr: 1200, lead: 600  },
  { carrier: "Verizon 5G Home",        product: "Home",        rep: 5500,  mgr: 1100, lead: 550  },
  { carrier: "Verizon 5G Home",        product: "Home Plus",   rep: 6500,  mgr: 1300, lead: 650  },
  { carrier: "Spectrum",               product: "500",         rep: 6500,  mgr: 1300, lead: 650  },
  { carrier: "Spectrum",               product: "1 Gig",       rep: 8500,  mgr: 1700, lead: 850  },
  { carrier: "Frontier Fiber",         product: "500",         rep: 7000,  mgr: 1400, lead: 700  },
  { carrier: "Frontier Fiber",         product: "1 Gig",       rep: 9000,  mgr: 1800, lead: 900  },
];

const SPEEDS = [300, 500, 1000, 2000, 5000];
const CATEGORIES = ["new", "migration", "mobility", "insurance"] as const;
const LEAD_STATUS_WEIGHTS: Array<[LeadStatus, number]> = [
  ["new", 35], ["attempted", 20], ["interested", 15],
  ["appointment", 10], ["sold", 12], ["lost", 8],
];

// ── Activity row helper ──────────────────────────────────────────────────────

interface ActivityRow {
  org_id: string;
  actor_id: string;
  team_id: string | null;
  lead_id: string | null;
  event_type: string;
  summary: string;
  ts: string;
  metadata: Record<string, unknown>;
  is_incident: boolean;
}

const INCIDENT_EVENTS = new Set([
  "no_solicit_observed",
  "complaint_received",
  "law_enforcement_contact",
  "trespass_warning",
]);

function activity(
  partial: Omit<ActivityRow, "metadata" | "is_incident"> & {
    metadata?: Record<string, unknown>;
  },
): ActivityRow {
  return {
    metadata: {},
    ...partial,
    is_incident: INCIDENT_EVENTS.has(partial.event_type),
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Seed: [DEMO PRO] Rouxte Showcase");
  console.log("================================");

  await wipeOrgsByPrefix(supabase, PRO_PREFIX);
  // Safety net: clean up any stale auth users left from prior failed runs
  // (e.g. RESTRICT FK from sales_activity_log blocking user deletion).
  await cleanupAuthUsersByEmailDomain(supabase, EMAIL_DOMAIN);

  // 1. Org
  console.log(`\nCreating ${ORG_NAME}...`);
  const { data: org, error: orgErr } = await supabase
    .from("orgs")
    .insert({
      name: ORG_NAME,
      provider_name: "AT&T Fiber",
      service_type: "fiber",
      provider_color: "#00A8E0",
      onboarding_state: {
        shape: "team",
        niche: "both",
        primary_carriers: ["att", "tmobile", "verizon_5g", "spectrum", "frontier"],
        brand_color: "#2563eb",
      },
      onboarding_completed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (orgErr || !org) throw new Error(`org insert failed: ${orgErr?.message}`);
  console.log(`  org id: ${org.id}`);

  // 2. Teams
  const teamsByKey = new Map<TeamKey, string>();
  for (const t of TEAMS) {
    const { data: team, error: teamErr } = await supabase
      .from("teams")
      .insert({ org_id: org.id, name: t.display, tier: 1, benefits: {} })
      .select()
      .single();
    if (teamErr || !team) throw new Error(`team insert failed: ${teamErr?.message}`);
    teamsByKey.set(t.key, team.id);
  }
  console.log(`  created ${TEAMS.length} teams.`);

  // 3. Users
  const users: SeededUser[] = [];
  let nameSeed = 1000;

  const createUser = async (
    role: Role,
    email: string,
    teamKey: TeamKey | null,
    options: { managedTeams?: TeamKey[] } = {},
  ): Promise<SeededUser | null> => {
    nameSeed++;
    const { full } = pickName(nameSeed);
    const { data: created, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: full },
    });
    if (authErr || !created.user) {
      console.warn(`  auth create failed for ${email}: ${authErr?.message}`);
      return null;
    }
    const teamId = teamKey ? teamsByKey.get(teamKey) ?? null : null;
    const { error: profErr } = await supabase.from("user_profiles").insert({
      user_id: created.user.id,
      org_id: org.id,
      team_id: teamId,
      role,
      full_name: full,
      onboarding_step: "complete",
      onboarding_complete: true,
    });
    if (profErr) {
      console.warn(`  profile insert failed for ${email}: ${profErr.message}`);
      return null;
    }
    return {
      user_id: created.user.id,
      email,
      role,
      team_key: teamKey,
      team_id: teamId,
      full_name: full,
      managed_teams: options.managedTeams,
    };
  };

  // Admin
  const admin = await createUser("admin", ADMIN_EMAIL, null);
  if (admin) users.push(admin);

  // Managers — each assigned to a primary team via team_id (the data model is
  // one-team-per-user). `managedTeams` is a TS-side annotation used for sign-off
  // routing; once a manager_teams join table exists, broaden the API too.
  const mgr1 = await createUser("sales_manager", `manager1@${EMAIL_DOMAIN}`, "alpha", {
    managedTeams: ["alpha", "bravo"],
  });
  if (mgr1) users.push(mgr1);
  const mgr2 = await createUser("sales_manager", `manager2@${EMAIL_DOMAIN}`, "charlie", {
    managedTeams: ["charlie", "delta"],
  });
  if (mgr2) users.push(mgr2);

  // Team leads — one per team
  let leadIdx = 0;
  for (const t of TEAMS) {
    leadIdx++;
    const lead = await createUser("team_lead", `lead${leadIdx}@${EMAIL_DOMAIN}`, t.key);
    if (lead) users.push(lead);
  }

  // Reps — distributed per team's rep_count
  let repIdx = 0;
  for (const t of TEAMS) {
    for (let i = 0; i < t.rep_count; i++) {
      repIdx++;
      const num = String(repIdx).padStart(2, "0");
      const rep = await createUser("sales_rep", `rep${num}@${EMAIL_DOMAIN}`, t.key);
      if (rep) users.push(rep);
    }
  }
  console.log(`  created ${users.length} users.`);

  const repsByTeam = (key: TeamKey): SeededUser[] =>
    users.filter((u) => u.role === "sales_rep" && u.team_key === key);
  const teamLead = (key: TeamKey): SeededUser | undefined =>
    users.find((u) => u.role === "team_lead" && u.team_key === key);
  const managerForTeam = (key: TeamKey): SeededUser | undefined =>
    users.find((u) => u.role === "sales_manager" && u.managed_teams?.includes(key));

  // 4. Subscription
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  await supabase.from("org_subscriptions").insert({
    org_id: org.id,
    status: "active",
    tier_key: "pro",
    trial_started_at: new Date(now - 180 * day).toISOString(),
    trial_ends_at: new Date(now - 150 * day).toISOString(),
    current_period_end: new Date(now + 24 * day).toISOString(),
    square_customer_id: `demo-cust-${org.id.slice(0, 8)}`,
    square_card_id: `demo-card-${org.id.slice(0, 8)}`,
    billing_email: ADMIN_EMAIL,
    billing_name: admin?.full_name ?? "Demo Admin",
    created_by: admin?.user_id ?? null,
    failed_charge_count: 0,
  });
  console.log("  created subscription (active / pro).");

  // 5. Comp plans
  await supabase.from("comp_plans").insert(
    COMP_PLANS.map((p) => ({
      org_id: org.id,
      carrier: p.carrier,
      product: p.product,
      rep_payout_cents: p.rep,
      manager_override_cents: p.mgr,
      lead_override_cents: p.lead,
    })),
  );
  console.log(`  created ${COMP_PLANS.length} comp plans.`);

  // 6. Leads — generate ~2000 with geo-spread + status mix
  const TOTAL_LEADS = 2000;
  type SeededLead = { id: string; team_key: TeamKey; status: LeadStatus };
  const leadsAll: SeededLead[] = [];
  const leadInserts: Array<Record<string, unknown>> = [];

  for (let i = 0; i < TOTAL_LEADS; i++) {
    const city = pickCity();
    const { address, lat, lng } = makeLeadAddress(city);
    const status = weighted(LEAD_STATUS_WEIGHTS);
    const team = pick(TEAMS);
    const teamReps = repsByTeam(team.key);
    const lead = teamReps.length > 0 ? pick(teamReps) : pick(users.filter((u) => u.role === "sales_rep"));
    const assigned = status === "new" ? null : (lead?.user_id ?? null);
    const createdAt = randomDateInLastDays(90).toISOString();

    leadInserts.push({
      org_id: org.id,
      address,
      lat,
      lng,
      status,
      created_by: lead?.user_id ?? admin!.user_id,
      assigned_to: assigned,
      carrier_availability: Math.random() < 0.6
        ? { att: true, competitors: [], tech_codes: ["50"], fcc_block_id: null }
        : { att: false, competitors: [], tech_codes: [], fcc_block_id: null },
      source: "manual",
      created_at: createdAt,
      updated_at: createdAt,
    });
    // We'll get IDs back via .select() after the insert
    leadsAll.push({ id: "", team_key: team.key, status });
  }

  // Chunked insert returning ids
  console.log(`  inserting ${TOTAL_LEADS} leads...`);
  const leadIds: string[] = [];
  for (let i = 0; i < leadInserts.length; i += 200) {
    const chunk = leadInserts.slice(i, i + 200);
    const { data, error } = await supabase.from("leads").insert(chunk).select("id");
    if (error) {
      console.warn(`  leads insert chunk failed at ${i}: ${error.message}`);
      continue;
    }
    for (const row of data ?? []) leadIds.push(row.id);
  }
  for (let i = 0; i < leadIds.length && i < leadsAll.length; i++) {
    leadsAll[i].id = leadIds[i];
  }
  console.log(`  inserted ${leadIds.length} leads.`);

  const leadsByTeam = (key: TeamKey): SeededLead[] =>
    leadsAll.filter((l) => l.id && l.team_key === key);

  // 7. Sales activity — every LogEventType across 90 days
  const activityRows: ActivityRow[] = [];
  const salesByActor = new Map<string, number>(); // for total_sales_count backfill

  for (const t of TEAMS) {
    const teamId = teamsByKey.get(t.key)!;
    const reps = repsByTeam(t.key);
    const lead = teamLead(t.key);
    const mgr = managerForTeam(t.key);
    const teamLeads = leadsByTeam(t.key);
    const pickTeamLeadId = () => (teamLeads.length > 0 ? pick(teamLeads).id : null);

    // Per-rep activity
    for (const rep of reps) {
      const counts = {
        door_knock:            rand(200, 600),
        status_changed:        rand(80, 200),
        note_added:            rand(50, 150),
        appointment_set:       rand(20, 50),
        appointment_missed:    rand(2, 8),
        quote_sent:            rand(30, 90),
        sale_submitted:        rand(t.sales_range[0], t.sales_range[1]),
        lead_pulled:           rand(5, 25),
        lead_auto_pulled:      rand(0, 5),
      };
      const appointmentCompleted = Math.floor(counts.appointment_set * (0.75 + Math.random() * 0.1));

      for (let i = 0; i < counts.door_knock; i++) {
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "door_knock",
          summary: "Door knocked",
          ts: randomDateInLastDays(90).toISOString(),
        }));
      }
      for (let i = 0; i < counts.status_changed; i++) {
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "status_changed",
          summary: "Status updated",
          ts: randomDateInLastDays(90).toISOString(),
        }));
      }
      for (let i = 0; i < counts.note_added; i++) {
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "note_added",
          summary: "Note added",
          ts: randomDateInLastDays(90).toISOString(),
        }));
      }
      for (let i = 0; i < counts.appointment_set; i++) {
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "appointment_set",
          summary: "Appointment scheduled",
          ts: randomDateInLastDays(90).toISOString(),
        }));
      }
      for (let i = 0; i < appointmentCompleted; i++) {
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "appointment_completed",
          summary: "Appointment completed",
          ts: randomDateInLastDays(90).toISOString(),
        }));
      }
      for (let i = 0; i < counts.appointment_missed; i++) {
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "appointment_missed",
          summary: "Appointment missed",
          ts: randomDateInLastDays(90).toISOString(),
        }));
      }
      for (let i = 0; i < counts.quote_sent; i++) {
        const qtype = Math.random() < 0.7 ? "fiber" : "wireless";
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "quote_sent",
          summary: `${qtype[0].toUpperCase()}${qtype.slice(1)} quote sent`,
          ts: randomDateInLastDays(90).toISOString(),
          metadata: { quote_type: qtype },
        }));
      }
      for (let i = 0; i < counts.lead_pulled; i++) {
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "lead_pulled",
          summary: "Pulled lead from queue",
          ts: randomDateInLastDays(90).toISOString(),
        }));
      }
      for (let i = 0; i < counts.lead_auto_pulled; i++) {
        activityRows.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "lead_auto_pulled",
          summary: "Lead auto-pulled (cooldown expired)",
          ts: randomDateInLastDays(90).toISOString(),
        }));
      }

      // Sales — track for total_sales_count backfill
      let salesForRep = 0;
      const saleEvents: ActivityRow[] = [];
      for (let i = 0; i < counts.sale_submitted; i++) {
        const plan = pick(COMP_PLANS);
        const speed = pick(SPEEDS);
        const category = pick(CATEGORIES);
        const ts = randomDateInLastDays(90).toISOString();
        saleEvents.push(activity({
          org_id: org.id, actor_id: rep.user_id, team_id: teamId,
          lead_id: pickTeamLeadId(),
          event_type: "sale_submitted",
          summary: `Sale: ${plan.carrier} ${plan.product}`,
          ts,
          metadata: {
            package_category: category,
            speed_mbps: speed,
            wireless_added: Math.random() < 0.35,
            payout_amount: plan.rep / 100,
            commission_amount: (plan.rep / 100) * 0.6,
            carrier: plan.carrier,
            product: plan.product,
          },
        }));
        salesForRep++;
      }
      activityRows.push(...saleEvents);
      salesByActor.set(rep.user_id, salesForRep);

      // Manager sign-off events for ~85% verified / ~5% rejected of sale_submitted
      if (mgr) {
        for (const s of saleEvents) {
          const roll = Math.random();
          if (roll < 0.85) {
            activityRows.push(activity({
              org_id: org.id, actor_id: mgr.user_id, team_id: teamId,
              lead_id: s.lead_id,
              event_type: "sale_verified",
              summary: "Manager verified sale",
              ts: new Date(new Date(s.ts).getTime() + rand(1, 48) * 60 * 60 * 1000).toISOString(),
              metadata: { reviewed_for: rep.full_name },
            }));
            activityRows.push(activity({
              org_id: org.id, actor_id: mgr.user_id, team_id: teamId,
              lead_id: s.lead_id,
              event_type: "manager_approved",
              summary: "Approved",
              ts: new Date(new Date(s.ts).getTime() + rand(1, 48) * 60 * 60 * 1000).toISOString(),
            }));
          } else if (roll < 0.90) {
            activityRows.push(activity({
              org_id: org.id, actor_id: mgr.user_id, team_id: teamId,
              lead_id: s.lead_id,
              event_type: "sale_rejected",
              summary: "Manager rejected sale (insufficient documentation)",
              ts: new Date(new Date(s.ts).getTime() + rand(1, 48) * 60 * 60 * 1000).toISOString(),
              metadata: { reason: "missing_proof" },
            }));
            activityRows.push(activity({
              org_id: org.id, actor_id: mgr.user_id, team_id: teamId,
              lead_id: s.lead_id,
              event_type: "manager_denied",
              summary: "Denied",
              ts: new Date(new Date(s.ts).getTime() + rand(1, 48) * 60 * 60 * 1000).toISOString(),
            }));
          }
        }
      }
    }

    // Team-lead-driven events: lead_assigned, lead_unassigned
    if (lead) {
      const teamLeadsArr = leadsByTeam(t.key);
      for (const rep of reps) {
        const assignCount = rand(5, 15);
        for (let i = 0; i < assignCount; i++) {
          if (teamLeadsArr.length === 0) break;
          activityRows.push(activity({
            org_id: org.id, actor_id: lead.user_id, team_id: teamId,
            lead_id: pick(teamLeadsArr).id,
            event_type: "lead_assigned",
            summary: `Assigned lead to ${rep.full_name}`,
            ts: randomDateInLastDays(90).toISOString(),
            metadata: { rep_id: rep.user_id },
          }));
        }
        const unassignCount = rand(0, 3);
        for (let i = 0; i < unassignCount; i++) {
          if (teamLeadsArr.length === 0) break;
          activityRows.push(activity({
            org_id: org.id, actor_id: lead.user_id, team_id: teamId,
            lead_id: pick(teamLeadsArr).id,
            event_type: "lead_unassigned",
            summary: "Unassigned (no follow-up in 14 days)",
            ts: randomDateInLastDays(90).toISOString(),
          }));
        }
      }
    }
  }

  // Org-wide compliance + manager events
  const allManagers = users.filter((u) => u.role === "sales_manager");
  const allLeads = leadsAll.filter((l) => l.id);
  const incidentEvents: ActivityRow[] = [];

  const composeIncident = (eventType: string, summary: string) => {
    const teamKey = pick(TEAMS).key;
    const teamId = teamsByKey.get(teamKey)!;
    const reps = repsByTeam(teamKey);
    if (reps.length === 0) return null;
    const actor = pick(reps);
    const teamLeadsArr = allLeads.filter((l) => l.team_key === teamKey);
    return activity({
      org_id: org.id, actor_id: actor.user_id, team_id: teamId,
      lead_id: teamLeadsArr.length > 0 ? pick(teamLeadsArr).id : null,
      event_type: eventType,
      summary,
      ts: randomDateInLastDays(90).toISOString(),
    });
  };

  for (let i = 0; i < rand(2, 4); i++) {
    const row = composeIncident("no_solicit_observed", "No-solicit sign observed at door");
    if (row) incidentEvents.push(row);
  }
  for (let i = 0; i < rand(1, 2); i++) {
    const row = composeIncident("complaint_received", "Complaint received from homeowner");
    if (row) incidentEvents.push(row);
  }
  for (let i = 0; i < rand(0, 1); i++) {
    const row = composeIncident("law_enforcement_contact", "Officer contacted rep on shift");
    if (row) incidentEvents.push(row);
  }
  incidentEvents.push(composeIncident("trespass_warning", "Trespass warning issued by property owner")!);

  activityRows.push(...incidentEvents.filter(Boolean));

  // Manager follow-ups on incidents
  for (const inc of incidentEvents) {
    if (!inc) continue;
    if (allManagers.length === 0) break;
    const mgr = pick(allManagers);
    if (Math.random() < 0.4) {
      activityRows.push(activity({
        org_id: org.id, actor_id: mgr.user_id, team_id: inc.team_id,
        lead_id: inc.lead_id,
        event_type: "manager_acknowledged",
        summary: "Acknowledged incident",
        ts: new Date(new Date(inc.ts).getTime() + rand(1, 6) * 60 * 60 * 1000).toISOString(),
      }));
    }
    activityRows.push(activity({
      org_id: org.id, actor_id: mgr.user_id, team_id: inc.team_id,
      lead_id: inc.lead_id,
      event_type: "incident_reviewed",
      summary: "Reviewed and closed",
      ts: new Date(new Date(inc.ts).getTime() + rand(6, 48) * 60 * 60 * 1000).toISOString(),
    }));
  }

  // Coach notes — 2-5 per manager
  for (const mgr of allManagers) {
    const count = rand(2, 5);
    for (const tk of mgr.managed_teams ?? []) {
      const teamId = teamsByKey.get(tk)!;
      const reps = repsByTeam(tk);
      if (reps.length === 0) continue;
      for (let i = 0; i < count; i++) {
        const rep = pick(reps);
        activityRows.push(activity({
          org_id: org.id, actor_id: mgr.user_id, team_id: teamId,
          lead_id: null,
          event_type: "coach_note_added",
          summary: `Coach note for ${rep.full_name}`,
          ts: randomDateInLastDays(60).toISOString(),
          metadata: { rep_id: rep.user_id, focus: pick(["objection_handling", "rebuttal_practice", "appointment_followup"]) },
        }));
      }
    }
  }

  // Insert activity in chunks
  console.log(`  inserting ${activityRows.length} activity rows...`);
  let inserted = 0;
  for (let i = 0; i < activityRows.length; i += 500) {
    const chunk = activityRows.slice(i, i + 500);
    const { error } = await supabase.from("sales_activity_log").insert(chunk);
    if (error) {
      console.warn(`  activity insert chunk ${i / 500} failed: ${error.message}`);
    } else {
      inserted += chunk.length;
    }
  }
  console.log(`  inserted ${inserted}/${activityRows.length} activity rows.`);

  // 8. Backfill total_sales_count + graduated_at
  console.log("  backfilling total_sales_count...");
  for (const [actor_id, count] of salesByActor.entries()) {
    if (count <= 0) continue;
    const patch: Record<string, unknown> = { total_sales_count: count };
    if (count >= 10) patch.graduated_at = randomDateInLastDays(60, 30).toISOString();
    await supabase.from("user_profiles").update(patch).eq("user_id", actor_id);
  }

  // 9. Quotes
  const quoteStatusWeights: Array<[string, number]> = [
    ["draft", 5], ["sent", 60], ["accepted", 30], ["declined", 5],
  ];
  const QUOTE_COUNT = 300;
  const quoteInserts: Array<Record<string, unknown>> = [];
  const reps = users.filter((u) => u.role === "sales_rep");
  for (let i = 0; i < QUOTE_COUNT; i++) {
    const rep = pick(reps);
    const lead = leadsAll.length > 0 ? pick(leadsAll.filter((l) => l.id)) : undefined;
    const status = weighted(quoteStatusWeights);
    const premium = rand(0, 3);
    const extra = rand(0, 2);
    const starter = rand(0, 1);
    const total = premium + extra + starter || 1;
    const portIn = rand(0, total);
    const newLines = rand(0, total - portIn);
    const upgrade = total - portIn - newLines;
    const monthly = premium * 95 + extra * 55 + starter * 35;
    const createdAt = randomDateInLastDays(60).toISOString();
    quoteInserts.push({
      org_id: org.id,
      rep_id: rep.user_id,
      lead_id: lead?.id ?? null,
      customer_name: `${pick(["Mr.", "Ms.", "Mrs."])} ${pickName(i * 11).last}`,
      total_lines: total,
      autopay_paperless: Math.random() < 0.7,
      discount_type: pick(["none", "appreciation", "signature"]),
      appreciation_type: Math.random() < 0.3 ? pick(["military", "first_responder", "union", "employee"]) : null,
      premium_lines: premium,
      extra_lines: extra,
      starter_lines: starter,
      port_in_lines: portIn,
      new_lines: newLines,
      upgrade_lines: upgrade,
      monthly_total: monthly,
      activation_fee: total * 35,
      status,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
  const insertedQuoteIds: string[] = [];
  for (let i = 0; i < quoteInserts.length; i += 100) {
    const chunk = quoteInserts.slice(i, i + 100);
    const { data, error } = await supabase.from("quotes").insert(chunk).select("id");
    if (error) {
      console.warn(`  quotes insert chunk failed: ${error.message}`);
      continue;
    }
    for (const r of data ?? []) insertedQuoteIds.push(r.id);
  }
  console.log(`  inserted ${insertedQuoteIds.length} quotes.`);

  // quote_lines — 1-3 per quote
  const lineInserts: Array<Record<string, unknown>> = [];
  for (const qid of insertedQuoteIds) {
    const lines = rand(1, 3);
    for (let n = 1; n <= lines; n++) {
      const planType = pick(["premium", "extra", "starter"] as const);
      const rate = planType === "premium" ? 95 : planType === "extra" ? 55 : 35;
      lineInserts.push({
        quote_id: qid,
        line_number: n,
        plan_type: planType,
        rate_plan: rate,
        plan_promo: 0,
        next_up: Math.random() < 0.3,
        next_up_amt: 6,
        insurance: Math.random() < 0.2 ? 18 : 0,
        retailer_promo: 0,
        device: 0,
        device_promo: 0,
        line_total: rate,
      });
    }
  }
  for (let i = 0; i < lineInserts.length; i += 500) {
    const chunk = lineInserts.slice(i, i + 500);
    await supabase.from("quote_lines").insert(chunk);
  }
  console.log(`  inserted ${lineInserts.length} quote lines.`);

  // 10. Training progress — for every rep, mark 40-95% of documents passed
  const { data: trainingDocs } = await supabase
    .from("training_documents")
    .select("id")
    .eq("folder", "training");
  if (trainingDocs && trainingDocs.length > 0) {
    const tpRows: Array<Record<string, unknown>> = [];
    for (const rep of reps) {
      const passPct = 0.4 + Math.random() * 0.55;
      const shuffled = [...trainingDocs].sort(() => Math.random() - 0.5);
      const passCount = Math.floor(shuffled.length * passPct);
      for (let i = 0; i < shuffled.length; i++) {
        const passed = i < passCount;
        const startedAt = randomDateInLastDays(60).toISOString();
        tpRows.push({
          user_id: rep.user_id,
          org_id: org.id,
          document_id: shuffled[i].id,
          started_at: startedAt,
          completed_at: passed ? new Date(new Date(startedAt).getTime() + rand(5, 60) * 60 * 1000).toISOString() : null,
          quiz_passed: passed,
          quiz_attempts: passed ? rand(1, 3) : rand(0, 2),
        });
      }
    }
    for (let i = 0; i < tpRows.length; i += 500) {
      const chunk = tpRows.slice(i, i + 500);
      const { error } = await supabase.from("training_progress").insert(chunk);
      if (error) console.warn(`  training_progress chunk failed: ${error.message}`);
    }
    console.log(`  inserted ${tpRows.length} training_progress rows.`);
  } else {
    console.warn("  no training_documents found — skipping training_progress seed.");
  }

  // 11. Sales goals — weekly + monthly per rep + 1 team goal per team
  const goalRows: Array<Record<string, unknown>> = [];
  for (const rep of reps) {
    goalRows.push({
      org_id: org.id,
      user_id: rep.user_id,
      period_type: "weekly",
      min_sales_count: rand(6, 10),
      assigned_by: admin?.user_id ?? null,
      effective_from: new Date(now - 14 * day).toISOString().slice(0, 10),
    });
    goalRows.push({
      org_id: org.id,
      user_id: rep.user_id,
      period_type: "monthly",
      min_sales_count: rand(24, 40),
      assigned_by: admin?.user_id ?? null,
      effective_from: new Date(now - 60 * day).toISOString().slice(0, 10),
    });
  }
  for (const t of TEAMS) {
    goalRows.push({
      org_id: org.id,
      team_id: teamsByKey.get(t.key),
      period_type: "monthly",
      min_sales_count: t.rep_count * 25,
      team_lead_bonus: rand(100, 250),
      assigned_by: admin?.user_id ?? null,
      effective_from: new Date(now - 30 * day).toISOString().slice(0, 10),
    });
  }
  await supabase.from("sales_goals").insert(goalRows);
  console.log(`  inserted ${goalRows.length} sales_goals.`);

  // 12. Notifications — 30-60 across users, mix of unread + read
  const notifTypes = ["incident", "sale_verified", "goal_progress", "mention", "lead_assigned"];
  const notifCount = rand(30, 60);
  const notifRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < notifCount; i++) {
    const target = pick(users.filter((u) => u.role !== "admin"));
    const type = pick(notifTypes);
    const createdAt = randomDateInLastDays(14).toISOString();
    notifRows.push({
      user_id: target.user_id,
      org_id: org.id,
      type,
      title: ({
        incident: "Incident logged",
        sale_verified: "Your sale was verified",
        goal_progress: "You're 80% to your weekly goal",
        mention: "You were mentioned in a coach note",
        lead_assigned: "New lead assigned to you",
      } as Record<string, string>)[type],
      body: ({
        incident: "Review the activity log for details.",
        sale_verified: "Commission will appear on the next payroll cycle.",
        goal_progress: "Two more sales this week hits the goal.",
        mention: "Open the coach feed to see what was said.",
        lead_assigned: "Check your queue to follow up.",
      } as Record<string, string>)[type],
      data: {},
      read_at: Math.random() < 0.5 ? null : new Date(new Date(createdAt).getTime() + rand(1, 72) * 60 * 60 * 1000).toISOString(),
      created_at: createdAt,
    });
  }
  await supabase.from("notifications").insert(notifRows);
  console.log(`  inserted ${notifRows.length} notifications.`);

  console.log(`\n✓ ${ORG_NAME} ready.`);
  console.log(`\nSign in:`);
  console.log(`    email:    ${ADMIN_EMAIL}`);
  console.log(`    password: ${DEMO_PASSWORD}`);
  console.log(`\n  Roles: admin · manager{1,2} · lead{1..4} · rep{01..36} all @${EMAIL_DOMAIN}`);
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
