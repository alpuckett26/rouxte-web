"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/ui/Card";

// ── Types ──────────────────────────────────────────────────────────────────

interface RepActivity {
  user_id: string;
  full_name: string;
  total: number;
  worked: number;
  worked_pct: number;
  oldest_age_days: number | null;
}

interface PullLogEntry {
  id: string;
  lead_id: string | null;
  actor_id: string;
  event_type: "lead_pulled" | "lead_auto_pulled";
  summary: string;
  metadata: Record<string, unknown>;
  ts: string;
}

interface TrackerData {
  rep_activity:   RepActivity[];
  pull_log:       PullLogEntry[];
  cooldown_total: number;
}

type WeekCounts = [number, number, number, number];

interface RepPerf {
  user_id: string;
  full_name: string;
  team_id: string | null;
  team_name: string | null;
  assigned_total: number;
  worked: number;
  worked_pct: number;
  week_activity: WeekCounts;
  trend: "up" | "down" | "flat";
}

interface TeamPerf {
  team_id: string;
  team_name: string;
  rep_count: number;
  assigned_total: number;
  worked: number;
  worked_pct: number;
  this_week_activity: number;
  last_week_activity: number;
  trend: "up" | "down" | "flat";
}

interface WeeklyData {
  reps:         RepPerf[];
  teams:        TeamPerf[];
  week_labels:  string[];
}

// ── Shared UI atoms ────────────────────────────────────────────────────────

function WorkedBar({ pct }: { pct: number }) {
  const color =
    pct >= 60 ? "bg-green-500" :
    pct >= 30 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${
        pct >= 60 ? "text-green-700" : pct >= 30 ? "text-yellow-600" : "text-red-500"
      }`}>{pct}%</span>
    </div>
  );
}

function AgeChip({ days }: { days: number | null }) {
  if (days == null) return <span className="text-xs text-gray-400">—</span>;
  const color =
    days >= 14 ? "bg-red-100 text-red-700" :
    days >= 7  ? "bg-yellow-100 text-yellow-700" :
                 "bg-gray-100 text-gray-600";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {days}d
    </span>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up")   return <span className="text-green-600 text-base">↑</span>;
  if (trend === "down") return <span className="text-red-500 text-base">↓</span>;
  return <span className="text-gray-400 text-base">→</span>;
}

// ── Main panel ─────────────────────────────────────────────────────────────

type Tab = "weekly" | "activity" | "pulls";

export default function LeadTrackerPanel() {
  const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
  const [weeklyData,  setWeeklyData]  = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("weekly");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [trackerRes, weeklyRes] = await Promise.all([
      fetch("/api/manager/leads/pull-history"),
      fetch("/api/manager/leads/weekly-perf"),
    ]);
    const [trackerJson, weeklyJson] = await Promise.all([
      trackerRes.json(), weeklyRes.json(),
    ]);
    setTrackerData(trackerJson.data ?? null);
    setWeeklyData(weeklyJson.data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Lead Tracker</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Rep &amp; team performance · weekly pow-wow view · auto-pull clock.
          {trackerData && ` ${trackerData.cooldown_total} leads in 6-month cooldown.`}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "weekly",   label: "Weekly Pow-Wow" },
          { key: "activity", label: "Assignment Health" },
          { key: "pulls",    label: "Pull History" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map((i) => <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : tab === "weekly" ? (
        <WeeklyTab data={weeklyData} />
      ) : tab === "activity" ? (
        <ActivityTab reps={trackerData?.rep_activity ?? []} />
      ) : (
        <PullsTab logs={trackerData?.pull_log ?? []} />
      )}
    </div>
  );
}

// ── Weekly Pow-Wow tab ─────────────────────────────────────────────────────

function WeeklyTab({ data }: { data: WeeklyData | null }) {
  if (!data) return <p className="text-sm text-gray-400 py-8 text-center">No data</p>;

  const { reps, teams, week_labels } = data;
  const sorted = [...reps].sort((a, b) => b.week_activity[0] - a.week_activity[0]);

  return (
    <div className="space-y-5">
      {/* Team summary cards */}
      {teams.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Teams</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.map((team) => (
              <div key={team.team_id} className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900">{team.team_name}</p>
                  <TrendIcon trend={team.trend} />
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  {team.rep_count} reps · {team.assigned_total} leads · {team.worked_pct}% worked
                </p>
                <div className="flex gap-4 text-xs">
                  <div>
                    <span className="text-gray-400">This week</span>
                    <span className="ml-1 font-bold text-gray-800">{team.this_week_activity}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Last week</span>
                    <span className="ml-1 font-medium text-gray-600">{team.last_week_activity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rep leaderboard */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Rep Performance</p>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_repeat(4,48px)_24px] gap-2 px-3 pb-1">
          <span className="text-xs text-gray-400">Rep</span>
          {week_labels.map((l, i) => (
            <span key={i} className="text-[10px] text-gray-400 text-center leading-tight">{l.replace(" weeks ago","w")}</span>
          ))}
          <span />
        </div>

        <div className="space-y-1">
          {sorted.map((rep) => (
            <div
              key={rep.user_id}
              className="grid grid-cols-[1fr_repeat(4,48px)_24px] gap-2 items-center px-3 py-2 rounded-xl hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{rep.full_name}</p>
                {rep.team_name && (
                  <p className="text-[11px] text-gray-400">{rep.team_name}</p>
                )}
              </div>
              {rep.week_activity.map((count, i) => (
                <span
                  key={i}
                  className={`text-sm font-semibold text-center ${
                    i === 0
                      ? count > 0 ? "text-gray-900" : "text-red-400"
                      : "text-gray-400"
                  }`}
                >
                  {count}
                </span>
              ))}
              <TrendIcon trend={rep.trend} />
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-2 px-1">
          Numbers = door knocks + status changes per week. Red zero = no activity this week.
        </p>
      </div>
    </div>
  );
}

// ── Assignment Health tab ──────────────────────────────────────────────────

function ActivityTab({ reps }: { reps: RepActivity[] }) {
  if (!reps.length) {
    return <p className="text-sm text-gray-400 py-8 text-center">No reps with assigned leads</p>;
  }

  const sorted = [...reps].sort((a, b) => {
    if (a.worked_pct !== b.worked_pct) return a.worked_pct - b.worked_pct;
    return (b.oldest_age_days ?? 0) - (a.oldest_age_days ?? 0);
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_40px_90px_60px] gap-3 px-3 pb-1">
        <span className="text-xs text-gray-400 uppercase tracking-wide">Rep</span>
        <span className="text-xs text-gray-400 uppercase tracking-wide text-right">Leads</span>
        <span className="text-xs text-gray-400 uppercase tracking-wide">Worked %</span>
        <span className="text-xs text-gray-400 uppercase tracking-wide">Oldest</span>
      </div>

      {sorted.map((rep) => (
        <Card key={rep.user_id} padding="sm">
          <div className="grid grid-cols-[1fr_40px_90px_60px] gap-3 items-center">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{rep.full_name}</p>
              <p className="text-xs text-gray-400">{rep.worked}/{rep.total} worked</p>
            </div>
            <span className="text-sm font-semibold text-gray-700 text-right">{rep.total}</span>
            <WorkedBar pct={rep.worked_pct} />
            <div className="flex justify-end">
              <AgeChip days={rep.oldest_age_days} />
            </div>
          </div>
        </Card>
      ))}

      <div className="flex gap-4 pt-1 px-1">
        {[
          { color: "bg-red-400",    label: "<30%" },
          { color: "bg-yellow-400", label: "30–59%" },
          { color: "bg-green-500",  label: "≥60%" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className={`w-3 h-1.5 rounded-full ${color}`} />
            <span>{label}</span>
          </div>
        ))}
        <span className="text-xs text-gray-400 ml-auto">Oldest = days since oldest unworked lead was assigned</span>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
        <strong>Auto-pull clock:</strong> &lt;30% after 7 days → new leads pulled · &lt;60% after 14 days → new+attempted pulled · after 21 days → all unworked pulled. All pulls get a 6-month cooldown.
      </div>
    </div>
  );
}

// ── Pull History tab ───────────────────────────────────────────────────────

function PullsTab({ logs }: { logs: PullLogEntry[] }) {
  if (!logs.length) {
    return <p className="text-sm text-gray-400 py-8 text-center">No leads pulled yet</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {logs.map((log) => {
        const meta  = log.metadata ?? {};
        const isAuto = log.event_type === "lead_auto_pulled";
        return (
          <div
            key={log.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-white"
          >
            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${isAuto ? "bg-yellow-400" : "bg-blue-500"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 leading-snug">{log.summary}</p>
              {meta.rep_id && (
                <p className="text-xs text-gray-400 mt-0.5">Rep: {String(meta.rep_id).slice(0, 8)}…</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isAuto ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
              }`}>
                {isAuto ? "AUTO" : "MANUAL"}
              </span>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(log.ts).toLocaleDateString()} {new Date(log.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
