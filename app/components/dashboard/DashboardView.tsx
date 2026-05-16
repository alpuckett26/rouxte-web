"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RepStats } from "@/lib/types";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import GoalProgressWidget from "@/components/dashboard/GoalProgressWidget";
import KnockHistoryWidget from "@/components/dashboard/KnockHistoryWidget";
import AnalyticsSummaryCard from "@/components/dashboard/AnalyticsSummaryCard";
import AccountabilityCard from "@/components/dashboard/AccountabilityCard";
import { useProfile } from "@/lib/hooks/useProfile";
import { LOG_EVENT_LABELS } from "@/lib/utils/logs";

interface DashData {
  rep_stats: RepStats;
  team_stats: RepStats[];
  pending_incidents: number;
  // admin extras
  total_reps?: number;
  total_teams?: number;
  org_name?: string;
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card padding="md" className="flex flex-col gap-1">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </Card>
  );
}

export default function DashboardView() {
  const { profile } = useProfile();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const role = profile?.role;

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !role) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const stats = data?.rep_stats;
  const isElevated = role === "admin" || role === "sales_manager" || role === "team_lead";
  const isManagerOrAdmin = role === "admin" || role === "sales_manager";

  const headings: Record<string, { title: string; sub: string }> = {
    admin:         { title: "Owner Dashboard",    sub: "Org-wide overview" },
    sales_manager: { title: "Manager Dashboard",  sub: "Your team at a glance" },
    team_lead:     { title: "Team Lead Dashboard", sub: "Your performance & team" },
    sales_rep:     { title: "Dashboard",          sub: "Your performance at a glance" },
  };
  const heading = headings[role] ?? headings.sales_rep;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{heading.title}</h1>
          <p className="text-sm text-gray-500">{heading.sub}</p>
        </div>
        {profile?.full_name && (
          <p className="hidden md:block text-sm text-gray-400">
            Hi, <span className="font-medium text-gray-700">{profile.full_name.split(" ")[0]}</span>
          </p>
        )}
      </div>

      {/* Goals widget — all roles */}
      <GoalProgressWidget />

      {/* Accountability chain — every role except admin */}
      <AccountabilityCard />

      {/* Analytics summary — elevated roles only, links to full /analytics */}
      {isElevated && <AnalyticsSummaryCard />}

      {/* Incident banner — elevated roles only */}
      {isElevated && !!data?.pending_incidents && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-medium text-red-700">
              {data.pending_incidents} incident{data.pending_incidents > 1 ? "s" : ""} pending review
            </p>
          </div>
          <Link href="/manager/queue" className="text-sm text-red-600 font-medium hover:underline">
            Review
          </Link>
        </div>
      )}

      {/* Admin org stats */}
      {role === "admin" && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Organization</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Total Reps" value={data?.total_reps ?? "—"} />
            <StatBox label="Total Teams" value={data?.total_teams ?? "—"} />
            <StatBox label="Sales This Month" value={stats?.sales ?? 0} />
            <StatBox label="Open Incidents" value={data?.pending_incidents ?? 0} />
          </div>
        </div>
      )}

      {/* Personal stats — all roles */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          {isElevated ? "My Personal Stats" : "My Stats"}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Doors Knocked" value={stats?.doors_knocked ?? 0} />
          <StatBox label="Contacts" value={stats?.contacts ?? 0} />
          <StatBox label="Appointments" value={stats?.appointments ?? 0} />
          <StatBox
            label="Sales"
            value={stats?.sales ?? 0}
            sub={`${stats?.conversion_pct?.toFixed(1) ?? "0.0"}% conversion`}
          />
        </div>
      </div>

      {/* Team leaderboard — elevated roles only */}
      {isElevated && data?.team_stats && data.team_stats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Team Leaderboard</p>
            {isManagerOrAdmin && (
              <Link href="/manager/team" className="text-xs text-blue-600 hover:underline">
                Full team view →
              </Link>
            )}
          </div>
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500">
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Rep</th>
                  <th className="px-4 py-3 text-right font-medium">Knocked</th>
                  <th className="px-4 py-3 text-right font-medium">Sales</th>
                  <th className="px-4 py-3 text-right font-medium">Conv %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.team_stats.map((rep, i) => (
                  <tr key={rep.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{rep.full_name}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{rep.doors_knocked}</td>
                    <td className="px-4 py-2.5 text-right text-green-600 font-medium">{rep.sales}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{rep.conversion_pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Knock history chart — reps and team leads */}
      {(role === "sales_rep" || role === "team_lead") && <KnockHistoryWidget />}

      {/* Rep submitted sales status */}
      {!isElevated && <RepSalesWidget />}

      {/* Quick actions — role-aware */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <p className="text-xs font-medium text-gray-500 mb-3">Quick Actions</p>
          <div className="flex flex-col gap-1.5">
            <Link href="/map" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
              <span className="text-blue-500">→</span> Open Field Map
            </Link>
            <Link href="/leads" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
              <span className="text-blue-500">→</span> View All Leads
            </Link>
            {isManagerOrAdmin && (
              <Link href="/manager/queue" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
                <span className="text-blue-500">→</span> Review Queue
              </Link>
            )}
            {isManagerOrAdmin && (
              <Link href="/manager/payroll" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
                <span className="text-blue-500">→</span> Payroll
              </Link>
            )}
            {role === "admin" && (
              <Link href="/manager/people" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
                <span className="text-blue-500">→</span> Manage People
              </Link>
            )}
            {role === "admin" && (
              <Link href="/manager/compensation" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
                <span className="text-blue-500">→</span> Commission Packages
              </Link>
            )}
            {!isManagerOrAdmin && (
              <Link href="/payroll" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
                <span className="text-blue-500">→</span> My Paystubs
              </Link>
            )}
          </div>
        </Card>

        {/* AI usage — reps and team leads */}
        {(role === "sales_rep" || role === "team_lead") && (
          <Card padding="md">
            <p className="text-xs font-medium text-gray-500 mb-3">AI Coaching Usage</p>
            <AIUsageWidget />
          </Card>
        )}

        {/* Manager extras */}
        {isManagerOrAdmin && (
          <Card padding="md">
            <p className="text-xs font-medium text-gray-500 mb-3">Management</p>
            <div className="flex flex-col gap-1.5">
              <Link href="/manager/compliance" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <span className="text-orange-500">→</span> Compliance Log
              </Link>
              <Link href="/manager/goals" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <span className="text-orange-500">→</span> Goal Settings
              </Link>
              <Link href="/manager/onboarding" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <span className="text-orange-500">→</span> Onboarding Docs
              </Link>
              {role === "admin" && (
                <Link href="/manager/teams" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <span className="text-orange-500">→</span> All Teams
                </Link>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

interface SaleEntry {
  id: string;
  created_at: string;
  lead_address: string | null;
  customer_name: string | null;
  metadata: Record<string, unknown>;
  status: "pending" | "verified" | "rejected";
  signoff_note: string | null;
}

interface ActivityEntry {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
}

function RepSalesWidget() {
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [tab, setTab] = useState<"sales" | "activity">("sales");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rep/sales")
      .then((r) => r.json())
      .then((d) => { setSales(d.sales ?? []); setActivity(d.activity ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending = sales.filter((s) => s.status === "pending");
  const verified = sales.filter((s) => s.status === "verified");
  const rejected = sales.filter((s) => s.status === "rejected");

  return (
    <div className="flex flex-col gap-3">
      {/* Summary pills */}
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          <span className="rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5">{pending.length} Pending</span>
          <span className="rounded-full bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5">{verified.length} Verified</span>
          {rejected.length > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">{rejected.length} Rejected</span>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab("sales")} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${tab === "sales" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>My Sales</button>
        <button onClick={() => setTab("activity")} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${tab === "activity" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Activity</button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : tab === "sales" ? (
        sales.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-gray-500 text-center py-4">No submitted sales yet</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {sales.map((s) => (
              <Card key={s.id} padding="sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {s.lead_address && <p className="text-sm font-medium text-gray-800 truncate">{s.lead_address}</p>}
                    {s.customer_name && <p className="text-xs text-gray-500">{s.customer_name}</p>}
                    {typeof s.metadata?.package === "string" && (
                      <p className="text-xs text-gray-400 mt-0.5">{s.metadata.package}</p>
                    )}
                    {s.signoff_note && (
                      <p className="text-xs text-gray-500 italic mt-1">"{s.signoff_note}"</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      label={s.status === "verified" ? "Verified" : s.status === "rejected" ? "Rejected" : "Pending"}
                      color={s.status === "verified" ? "green" : s.status === "rejected" ? "red" : "yellow"}
                    />
                    <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        activity.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-gray-50">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{a.summary}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {LOG_EVENT_LABELS[a.event_type as keyof typeof LOG_EVENT_LABELS] ?? a.event_type} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function AIUsageWidget() {
  const [usage, setUsage] = useState<{ prompts_used: number; total_prompts_used: number } | null>(null);

  useEffect(() => {
    fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((d) => setUsage(d))
      .catch(() => {});
  }, []);

  const daily = usage?.prompts_used ?? 0;
  const total = usage?.total_prompts_used ?? 0;
  const dailyMax = 3;
  const totalMax = 15;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Today</span><span>{daily} / {dailyMax}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min((daily / dailyMax) * 100, 100)}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Total cap</span><span>{total} / {totalMax}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div className="h-2 rounded-full bg-purple-500 transition-all" style={{ width: `${Math.min((total / totalMax) * 100, 100)}%` }} />
        </div>
      </div>
      <p className="text-xs text-gray-400">Team tiers unlock additional AI prompts</p>
    </div>
  );
}
