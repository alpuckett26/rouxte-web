import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/auth/super-admin";

/**
 * GET /api/analytics/sales-history?range=7d|30d|90d|1y
 *
 * Returns daily series + roll-ups for sales + quotes_sent over the
 * requested window. Used by the /analytics page and the dashboard
 * summary card.
 *
 * Auth: admin / sales_manager / team_lead (full org view). Super-admins
 * can pass ?org_id=<uuid> to scope to another org for troubleshooting.
 * Other roles → 403.
 */

const RANGE_DAYS: Record<string, number> = {
  "7d":  7,
  "30d": 30,
  "90d": 90,
  "1y":  365,
};

type RawRow = { ts: string; event_type: string; metadata: Record<string, unknown> | null };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") ?? "30d") as keyof typeof RANGE_DAYS;
  const days = RANGE_DAYS[range] ?? 30;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("org_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 400 });

  const isSuperAdmin = isSuperAdminEmail(user.email);
  const allowedRoles = ["admin", "sales_manager", "team_lead"];
  if (!isSuperAdmin && !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Super-admin can override org via query param
  const orgIdOverride = searchParams.get("org_id");
  const orgId = (isSuperAdmin && orgIdOverride) ? orgIdOverride : profile.org_id;

  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const since = new Date(sinceMs);

  const { data: rows, error } = await admin
    .from("sales_activity_log")
    .select("ts, event_type, metadata")
    .eq("org_id", orgId)
    .in("event_type", ["sale_submitted", "quote_sent"])
    .gte("ts", since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pre-fill series with zero buckets per day so the chart shows a continuous timeline
  const series: Record<string, { date: string; sales: number; quotes_sent: number; wireless_attached: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(sinceMs + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    series[key] = { date: key, sales: 0, quotes_sent: 0, wireless_attached: 0 };
  }

  let totalSales = 0;
  let totalQuotes = 0;
  let totalWireless = 0;
  const bySpeed: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byQuoteType: Record<string, number> = {};

  for (const raw of (rows ?? []) as RawRow[]) {
    const dateKey = raw.ts.slice(0, 10);
    const bucket = series[dateKey];
    const m = raw.metadata ?? {};

    if (raw.event_type === "sale_submitted") {
      totalSales++;
      if (bucket) bucket.sales++;

      const speed = typeof m.speed_mbps === "number" ? m.speed_mbps : null;
      const speedBucket = speedKey(speed);
      bySpeed[speedBucket] = (bySpeed[speedBucket] ?? 0) + 1;

      const category = typeof m.package_category === "string" ? m.package_category : "other";
      byCategory[category] = (byCategory[category] ?? 0) + 1;

      if (m.wireless_added === true) {
        totalWireless++;
        if (bucket) bucket.wireless_attached++;
      }
    } else if (raw.event_type === "quote_sent") {
      totalQuotes++;
      if (bucket) bucket.quotes_sent++;

      const qt = typeof m.quote_type === "string" ? m.quote_type : "other";
      byQuoteType[qt] = (byQuoteType[qt] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    range,
    series: Object.values(series),
    totals: {
      sales: totalSales,
      quotes_sent: totalQuotes,
      wireless_attached: totalWireless,
      attach_rate_pct: totalSales ? Math.round((totalWireless / totalSales) * 100) : 0,
      by_speed: bySpeed,
      by_category: byCategory,
      by_quote_type: byQuoteType,
    },
  });
}

function speedKey(speed: number | null): string {
  if (speed === null) return "unknown";
  if (speed >= 5000) return "5000+";
  if (speed >= 2000) return "2000";
  if (speed >= 1000) return "1000";
  if (speed >= 500)  return "500";
  if (speed >= 300)  return "300";
  return "other";
}
