"use client";

import { useCallback, useEffect, useState } from "react";
import type { LeaderboardEntry, Metric, Period } from "@/app/api/leaderboard/route";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today",   label: "Today" },
  { key: "week",    label: "This Week" },
  { key: "month",   label: "This Month" },
  { key: "alltime", label: "All Time" },
];

const METRICS: { key: Metric; label: string; pathD: string }[] = [
  {
    key: "sales",
    label: "Sales",
    pathD: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    key: "appointments",
    label: "Appointments",
    pathD: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  },
  {
    key: "doors",
    label: "Doors",
    pathD: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25",
  },
  {
    key: "training",
    label: "Training",
    pathD: "M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5",
  },
];

const MEDAL = ["🥇", "🥈", "🥉"];
const PODIUM_GRADIENT = [
  "from-amber-400 to-yellow-500",
  "from-slate-300 to-slate-400",
  "from-amber-600 to-orange-700",
];

function getMetricValue(e: LeaderboardEntry, m: Metric) {
  if (m === "appointments") return e.appointments;
  if (m === "doors")        return e.doors;
  if (m === "training")     return e.training_pct;
  return e.sales;
}

function getMetricSuffix(m: Metric) {
  if (m === "appointments") return "appts";
  if (m === "doors")        return "doors";
  if (m === "training")     return "%";
  return "sales";
}

// ── Podium card ─────────────────────────────────────────────────────────────
function PodiumCard({ entry, place, metric }: { entry: LeaderboardEntry; place: 1 | 2 | 3; metric: Metric }) {
  const isFirst = place === 1;
  const value   = getMetricValue(entry, metric);
  const suffix  = getMetricSuffix(metric);

  return (
    <div className={`flex flex-col items-center gap-2 ${place === 1 ? "order-2" : place === 2 ? "order-1" : "order-3"}`}>
      <span className="text-2xl leading-none">{MEDAL[place - 1]}</span>

      {/* Avatar ring */}
      <div className={`relative rounded-full bg-gradient-to-b ${PODIUM_GRADIENT[place - 1]} p-0.5 ${entry.is_me ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-[#0a0f1e]" : ""}`}>
        <div className={`flex items-center justify-center rounded-full bg-[#0a0f1e] font-black text-white ${isFirst ? "w-14 h-14 text-xl" : "w-10 h-10 text-base"}`}>
          {entry.full_name.charAt(0)}
        </div>
      </div>

      <div className="text-center">
        <p className={`font-bold text-white truncate max-w-[96px] ${isFirst ? "text-sm" : "text-xs"}`}>
          {entry.full_name.split(" ")[0]}
        </p>
        {entry.team_name && <p className="text-[9px] text-gray-600 truncate max-w-[96px]">{entry.team_name}</p>}
      </div>

      {/* Score pill */}
      <div className={`rounded-xl px-3 py-1.5 text-center bg-gradient-to-br ${PODIUM_GRADIENT[place - 1]}`}>
        <p className={`font-black text-white leading-none ${isFirst ? "text-2xl" : "text-lg"}`}>{value}{metric === "training" ? "%" : ""}</p>
        <p className="text-[9px] text-white/60 font-medium mt-0.5">{suffix}</p>
      </div>

      {/* Goal mini-bar (sales only) */}
      {metric === "sales" && entry.goal && (
        <div className="w-full max-w-[96px]">
          <div className="h-1 rounded-full bg-white/10">
            <div className={`h-1 rounded-full bg-gradient-to-r ${PODIUM_GRADIENT[place - 1]}`}
              style={{ width: `${Math.min(100, entry.goal_pct ?? 0)}%` }} />
          </div>
          <p className="text-[9px] text-gray-600 text-center mt-0.5">{entry.goal_pct ?? 0}% of goal</p>
        </div>
      )}

      {/* Podium step */}
      <div className={`w-full rounded-t-xl bg-white/5 border-t border-x border-white/10 ${isFirst ? "h-10" : place === 2 ? "h-6" : "h-3"}`} />
    </div>
  );
}

// ── Row (4th+) ───────────────────────────────────────────────────────────────
function LeaderRow({ entry, metric }: { entry: LeaderboardEntry; metric: Metric }) {
  const value  = getMetricValue(entry, metric);
  const suffix = getMetricSuffix(metric);

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
      entry.is_me ? "border-blue-500/30 bg-blue-600/10" : "border-white/10 bg-white/[0.03]"
    }`}>
      <span className="w-5 text-center text-sm font-bold text-gray-600 shrink-0">{entry.rank}</span>

      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
        entry.is_me ? "bg-blue-600/40 text-blue-300" : "bg-white/10 text-gray-400"
      }`}>
        {entry.full_name.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${entry.is_me ? "text-blue-300" : "text-gray-200"}`}>
          {entry.full_name}
          {entry.is_me && <span className="ml-1.5 text-[10px] text-blue-500 font-normal">you</span>}
        </p>
        {entry.team_name && <p className="text-[10px] text-gray-600 truncate">{entry.team_name}</p>}
      </div>

      {/* Training progress bar */}
      {metric === "training" && (
        <div className="hidden sm:block w-24">
          <div className="h-1.5 rounded-full bg-white/10">
            <div
              className={`h-1.5 rounded-full transition-all ${
                entry.training_pct === 100 ? "bg-emerald-500" :
                entry.training_pct >= 50   ? "bg-blue-500" : "bg-amber-500"
              }`}
              style={{ width: `${entry.training_pct}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-600 mt-0.5 text-right">
            {entry.training_modules} modules
          </p>
        </div>
      )}

      {/* Goal progress bar (sales only) */}
      {metric === "sales" && entry.goal && (
        <div className="hidden sm:block w-24">
          <div className="h-1.5 rounded-full bg-white/10">
            <div
              className={`h-1.5 rounded-full transition-all ${
                (entry.goal_pct ?? 0) >= 100 ? "bg-emerald-500" :
                (entry.goal_pct ?? 0) >= 50  ? "bg-blue-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, entry.goal_pct ?? 0)}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-600 mt-0.5 text-right">{entry.goal_pct ?? 0}% of goal</p>
        </div>
      )}

      <div className="text-right shrink-0">
        <p className={`text-lg font-black tabular-nums ${entry.is_me ? "text-blue-300" : "text-white"}`}>
          {value}{metric === "training" ? "%" : ""}
        </p>
        <p className="text-[10px] text-gray-600">{suffix}</p>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState<Period>("week");
  const [metric,  setMetric]  = useState<Metric>("sales");

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/leaderboard?period=${period}&metric=${metric}`);
    const data = await res.json();
    setEntries(data.data ?? []);
    setLoading(false);
  }, [period, metric]);

  useEffect(() => { load(); }, [load]);

  const top3    = entries.slice(0, Math.min(3, entries.length));
  const rest    = entries.slice(3);
  const myEntry = entries.find((e) => e.is_me);

  return (
    <main className="p-4 md:p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Leaderboard</h1>
          {myEntry && (
            <p className="text-xs text-gray-400">
              You&apos;re <span className="text-blue-400 font-bold">#{myEntry.rank}</span>
              {" "}· {getMetricValue(myEntry, metric)}{metric === "training" ? "%" : ""} {getMetricSuffix(metric)}
              {metric === "sales" && myEntry.goal && ` · ${myEntry.goal_pct ?? 0}% of goal`}
            </p>
          )}
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              period === p.key ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Metric filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
              metric === m.key
                ? "border-blue-500/50 bg-blue-600/20 text-blue-300"
                : "border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={m.pathD} />
            </svg>
            {m.label}
          </button>
        ))}
      </div>

      {/* Note about training being all-time */}
      {metric === "training" && period !== "alltime" && (
        <p className="text-xs text-gray-600 mb-4 flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          Training progress is cumulative regardless of period selected.
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          <div className="h-52 rounded-2xl bg-white/5 animate-pulse" />
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && entries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <p className="text-sm text-gray-500">No activity yet for this period.</p>
          <p className="text-xs text-gray-600 mt-1">Get out there and knock some doors.</p>
        </div>
      )}

      {/* Content */}
      {!loading && entries.length > 0 && (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-2 mb-8 px-2">
              {top3.map((e, i) => (
                <PodiumCard key={e.user_id} entry={e} place={(i + 1) as 1 | 2 | 3} metric={metric} />
              ))}
            </div>
          )}

          {/* 4th+ list */}
          {rest.length > 0 && (
            <div className="flex flex-col gap-2">
              {rest.map((e) => <LeaderRow key={e.user_id} entry={e} metric={metric} />)}
            </div>
          )}

          {/* Sticky "you" row if not in visible list (edge case for large orgs) */}
          {myEntry && myEntry.rank > entries.length && (
            <div className="mt-4">
              <LeaderRow entry={myEntry} metric={metric} />
            </div>
          )}
        </>
      )}
    </main>
  );
}
