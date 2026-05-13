import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { paystubEmail } from "@/lib/email/templates";

const TRIAL_WEEKS = 2;
const TRIAL_SALES_THRESHOLD = 10;

interface Params { params: Promise<{ id: string }> }

/**
 * POST /api/payroll/periods/[id]/generate
 * Builds a paystub for every active rep in the org for this pay period.
 * Idempotent — re-running updates existing draft stubs.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id: periodId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from("user_profiles").select("org_id, role").eq("user_id", user.id).maybeSingle();
  if (!callerProfile || !["admin", "sales_manager"].includes(callerProfile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate period belongs to org
  const { data: period } = await admin
    .from("pay_periods")
    .select("*")
    .eq("id", periodId)
    .eq("org_id", callerProfile.org_id)
    .maybeSingle();
  if (!period) return NextResponse.json({ error: "Pay period not found" }, { status: 404 });

  // Org override rates — team_lead and sales_manager get a % of every team
  // sale. Defaults are 2% / 4% set via the orgs columns; managers can tune
  // them in the Compensation screen.
  const { data: orgRow } = await admin
    .from("orgs")
    .select("team_lead_override_pct, manager_override_pct")
    .eq("id", callerProfile.org_id)
    .maybeSingle();
  const teamLeadOverridePct = Number(orgRow?.team_lead_override_pct ?? 0);
  const managerOverridePct  = Number(orgRow?.manager_override_pct  ?? 0);

  const periodStart = new Date(`${period.period_start}T00:00:00Z`);
  const periodEnd   = new Date(`${period.period_end}T23:59:59Z`);

  // Get all reps in org
  const { data: reps } = await admin
    .from("user_profiles")
    .select("user_id, full_name, sales_tier_id, hourly_rate, total_sales_count, trial_started_at, graduated_at, standing, team_id")
    .eq("org_id", callerProfile.org_id)
    .eq("role", "sales_rep");

  // Team-membership lookup — used by the override passes below.
  // Each team_members row is a (team_id, user_id, role) tuple. A sales_manager
  // is paid override only on sales in teams where they have a 'sales_manager'
  // membership row (per-team assignment, per the locked-in design).
  const { data: teamMemberships } = await admin
    .from("team_members")
    .select("team_id, user_id, role, teams!inner(org_id, name)")
    .eq("teams.org_id", callerProfile.org_id);

  // team_id → user_id of the team_lead (one per team)
  const teamLeadByTeam: Record<string, string> = {};
  // team_id → array of sales_manager user_ids
  const managersByTeam: Record<string, string[]> = {};
  // team_id → team name (for line item labels)
  const teamNameById: Record<string, string> = {};
  for (const tm of teamMemberships ?? []) {
    const teamRel = (tm as { teams?: { name?: string } }).teams;
    if (teamRel?.name) teamNameById[tm.team_id] = teamRel.name;
    if (tm.role === "team_lead") teamLeadByTeam[tm.team_id] = tm.user_id;
    if (tm.role === "sales_manager") {
      if (!managersByTeam[tm.team_id]) managersByTeam[tm.team_id] = [];
      managersByTeam[tm.team_id]!.push(tm.user_id);
    }
  }

  if (!reps?.length) return NextResponse.json({ stubs_generated: 0 });

  // Get tier commission_pct for all tier ids
  const tierIds = [...new Set(reps.map((r) => r.sales_tier_id).filter(Boolean))];
  const { data: tiers } = tierIds.length
    ? await admin.from("sales_tiers").select("id, commission_pct, name").in("id", tierIds)
    : { data: [] };
  const tierMap: Record<string, { commission_pct: number; name: string }> =
    Object.fromEntries((tiers ?? []).map((t) => [t.id, t]));

  // Get all sale_submitted logs in this period for org
  const { data: saleLogs } = await admin
    .from("sales_activity_log")
    .select("actor_id, metadata, lead_id, ts, id")
    .eq("org_id", callerProfile.org_id)
    .eq("event_type", "sale_submitted")
    .gte("ts", periodStart.toISOString())
    .lte("ts", periodEnd.toISOString());

  // Group logs by user
  const logsByUser: Record<string, typeof saleLogs> = {};
  for (const log of saleLogs ?? []) {
    if (!logsByUser[log.actor_id]) logsByUser[log.actor_id] = [];
    logsByUser[log.actor_id]!.push(log);
  }

  // Get unapplied chargebacks per user
  const { data: pendingChargebacks } = await admin
    .from("chargebacks")
    .select("user_id, payout_amount, id, reason, lead_id, created_at")
    .eq("org_id", callerProfile.org_id)
    .is("applied_to_stub", null);

  const chargebacksByUser: Record<string, typeof pendingChargebacks> = {};
  for (const cb of pendingChargebacks ?? []) {
    if (!chargebacksByUser[cb.user_id]) chargebacksByUser[cb.user_id] = [];
    chargebacksByUser[cb.user_id]!.push(cb);
  }

  // Get active bonus goals for this period type
  const { data: bonusGoals } = await admin
    .from("bonus_goals")
    .select("*")
    .eq("org_id", callerProfile.org_id)
    .eq("active", true)
    .eq("period_type", "weekly");

  const generatedStubIds: string[] = [];

  for (const rep of reps) {
    // Determine pay type
    const trialEnd = new Date(rep.trial_started_at);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_WEEKS * 7);
    const inTrial = !rep.graduated_at && (rep.total_sales_count ?? 0) < TRIAL_SALES_THRESHOLD;
    const payType: "hourly" | "commission" = inTrial ? "hourly" : "commission";

    const repLogs = logsByUser[rep.user_id] ?? [];
    const repChargebacks = chargebacksByUser[rep.user_id] ?? [];

    // Build line items
    const lineItems: object[] = [];

    if (payType === "hourly") {
      // Hours will be filled in by manager; start with 0
      lineItems.push({
        type: "hours",
        hours: 0,
        rate: rep.hourly_rate ?? 0,
        gross: 0,
      });
    } else {
      const tier = rep.sales_tier_id ? tierMap[rep.sales_tier_id] : null;
      for (const log of repLogs) {
        const payout = Number(log.metadata?.payout_amount) || 0;
        const commPct = tier?.commission_pct ?? 0;
        const commission = (commPct / 100) * payout;
        lineItems.push({
          type: "sale",
          log_id: log.id,
          lead_id: log.lead_id,
          date: log.ts,
          package: log.metadata?.package_name ?? "Package",
          payout_amount: payout,
          commission_pct: commPct,
          commission_amount: commission,
          customer_name: log.metadata?.customer_name ?? null,
          tier_name: tier?.name ?? null,
        });
      }
    }

    // Chargebacks
    let chargebackTotal = 0;
    for (const cb of repChargebacks) {
      chargebackTotal += Number(cb.payout_amount);
      lineItems.push({
        type: "chargeback",
        chargeback_id: cb.id,
        lead_id: cb.lead_id,
        date: cb.created_at,
        reason: cb.reason ?? "Sale reversal",
        payout_amount: Number(cb.payout_amount),
      });
    }

    // Commission gross
    const grossCommission = payType === "commission"
      ? (lineItems as Array<{ type: string; commission_amount?: number }>)
          .filter((l) => l.type === "sale")
          .reduce((s, l) => s + (l.commission_amount ?? 0), 0)
      : 0;

    // Bonus goals
    let bonusTotal = 0;
    for (const goal of bonusGoals ?? []) {
      const hitCount = goal.target_sales_count != null && repLogs.length >= goal.target_sales_count;
      const hitRevenue = goal.target_revenue != null
        ? repLogs.reduce((s, l) => s + (Number(l.metadata?.payout_amount) || 0), 0) >= goal.target_revenue
        : true;
      if (hitCount && hitRevenue) {
        bonusTotal += Number(goal.bonus_amount);
        lineItems.push({ type: "bonus", name: goal.name, amount: Number(goal.bonus_amount) });
      }
    }

    // Net pay
    const hourlyGross = payType === "hourly" ? 0 : 0; // filled in by manager
    const netPay = payType === "hourly"
      ? hourlyGross + bonusTotal - chargebackTotal
      : grossCommission + bonusTotal - chargebackTotal;

    // Upsert stub
    const { data: stub } = await admin
      .from("paystubs")
      .upsert(
        {
          org_id: callerProfile.org_id,
          user_id: rep.user_id,
          pay_period_id: periodId,
          period_start: period.period_start,
          period_end: period.period_end,
          pay_type: payType,
          hourly_rate: rep.hourly_rate ?? null,
          hours_worked: payType === "hourly" ? null : null,
          gross_commission: grossCommission,
          chargebacks: chargebackTotal,
          bonus: bonusTotal,
          net_pay: Math.max(0, netPay),
          line_items: lineItems,
          sales_count: repLogs.length,
          status: "pending_approval",
        },
        { onConflict: "user_id,pay_period_id" }
      )
      .select("id")
      .single();

    if (stub) {
      generatedStubIds.push(stub.id);
      // Mark chargebacks as applied
      if (repChargebacks.length && stub.id) {
        await admin
          .from("chargebacks")
          .update({ applied_to_stub: stub.id })
          .in("id", repChargebacks.map((c) => c.id));
      }
    }
  }

  // ─── Override commission pass ─────────────────────────────────────────────
  // Build a map of repId → user_profile (with team_id) for fast lookup
  const repsById: Record<string, { team_id: string | null; full_name: string | null }> =
    Object.fromEntries(reps.map((r) => [r.user_id, { team_id: r.team_id, full_name: r.full_name }]));

  // Aggregate override earnings: recipientUserId → { lineItems[], total, role, sourceTeams: Set }
  interface OverrideAgg {
    role: "team_lead" | "sales_manager";
    lineItems: object[];
    total: number;
    salesCount: number;
  }
  const overrideAggs: Record<string, OverrideAgg> = {};

  if (teamLeadOverridePct > 0 || managerOverridePct > 0) {
    for (const log of saleLogs ?? []) {
      const repId = log.actor_id;
      const teamId = repsById[repId]?.team_id;
      if (!teamId) continue; // rep not on a team → no overrides
      const payout = Number((log.metadata as Record<string, unknown> | null | undefined)?.payout_amount) || 0;
      if (payout <= 0) continue;

      // Team lead override
      const teamLeadId = teamLeadByTeam[teamId];
      if (teamLeadId && teamLeadId !== repId && teamLeadOverridePct > 0) {
        const amount = (teamLeadOverridePct / 100) * payout;
        const agg = overrideAggs[teamLeadId] ?? { role: "team_lead", lineItems: [], total: 0, salesCount: 0 };
        agg.lineItems.push({
          type: "team_lead_override",
          log_id: log.id,
          lead_id: log.lead_id,
          date: log.ts,
          rep_id: repId,
          rep_name: repsById[repId]?.full_name ?? null,
          team_id: teamId,
          team_name: teamNameById[teamId] ?? null,
          payout_amount: payout,
          override_pct: teamLeadOverridePct,
          override_amount: amount,
        });
        agg.total += amount;
        agg.salesCount += 1;
        overrideAggs[teamLeadId] = agg;
      }

      // Sales-manager override(s) — assigned per-team
      if (managerOverridePct > 0) {
        const managers = managersByTeam[teamId] ?? [];
        for (const mgrId of managers) {
          if (mgrId === repId) continue; // don't pay self-override on own sale
          const amount = (managerOverridePct / 100) * payout;
          const agg = overrideAggs[mgrId] ?? { role: "sales_manager", lineItems: [], total: 0, salesCount: 0 };
          agg.lineItems.push({
            type: "manager_override",
            log_id: log.id,
            lead_id: log.lead_id,
            date: log.ts,
            rep_id: repId,
            rep_name: repsById[repId]?.full_name ?? null,
            team_id: teamId,
            team_name: teamNameById[teamId] ?? null,
            payout_amount: payout,
            override_pct: managerOverridePct,
            override_amount: amount,
          });
          agg.total += amount;
          agg.salesCount += 1;
          overrideAggs[mgrId] = agg;
        }
      }
    }
  }

  // Persist override stubs (one per recipient). Use commission pay_type;
  // sales_count counts overrides earned, not own sales.
  for (const [recipientId, agg] of Object.entries(overrideAggs)) {
    const { data: recipientProfile } = await admin
      .from("user_profiles")
      .select("full_name")
      .eq("user_id", recipientId)
      .maybeSingle();

    const { data: stub } = await admin
      .from("paystubs")
      .upsert(
        {
          org_id: callerProfile.org_id,
          user_id: recipientId,
          pay_period_id: periodId,
          period_start: period.period_start,
          period_end: period.period_end,
          pay_type: "commission",
          hourly_rate: null,
          hours_worked: null,
          gross_commission: agg.total,
          chargebacks: 0,
          bonus: 0,
          net_pay: agg.total,
          line_items: agg.lineItems,
          sales_count: agg.salesCount,
          status: "pending_approval",
          manager_notes: agg.role === "team_lead"
            ? `Team-lead override @ ${teamLeadOverridePct}% — paid by ${(recipientProfile?.full_name ?? "team lead")}'s team sales`
            : `Sales-manager override @ ${managerOverridePct}% — paid by assigned-team sales`,
        },
        { onConflict: "user_id,pay_period_id" }
      )
      .select("id")
      .single();
    if (stub) generatedStubIds.push(stub.id);
  }

  // Mark period as closed
  await admin.from("pay_periods").update({ status: "closed" }).eq("id", periodId);

  // Send paystub notification emails (best-effort)
  if (generatedStubIds.length && process.env.RESEND_API_KEY) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rouxte.com";
    const periodLabel = `${period.period_start} – ${period.period_end}`;

    for (const rep of reps) {
      const stubId = generatedStubIds.find((_, i) => reps[i]?.user_id === rep.user_id);
      if (!stubId) continue;

      const { data: authUser } = await admin.auth.admin.getUserById(rep.user_id);
      const email = authUser?.user?.email;
      if (!email || !rep.full_name) continue;

      const netPay = Math.max(0,
        (logsByUser[rep.user_id] ?? []).reduce((s, l) => s + (Number(l.metadata?.payout_amount) || 0), 0)
        - (chargebacksByUser[rep.user_id] ?? []).reduce((s, c) => s + Number(c.payout_amount), 0)
      );

      const { subject, html } = paystubEmail({
        repName: rep.full_name.split(" ")[0],
        periodLabel,
        netPay,
        viewUrl: `${appUrl}/payroll/stubs/${stubId}/print`,
      });

      await sendEmail({ from: FROM, to: email, subject, html });
    }
  }

  return NextResponse.json({ stubs_generated: generatedStubIds.length });
}
