"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RepStats } from "@/lib/types";
import Card from "@/components/ui/Card";

interface DashData {
  rep_stats: RepStats;
  team_stats: RepStats[];
  pending_incidents: number;
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
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const stats = data?.rep_stats;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Your performance at a glance</p>
      </div>

      {data?.pending_incidents ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-medium text-red-700">
              {data.pending_incidents} incident{data.pending_incidents > 1 ? "s" : ""} pending manager review
            </p>
          </div>
          <Link href="/manager/queue" className="text-sm text-red-600 font-medium hover:underline">
            Review
          </Link>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">My Stats</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Doors Knocked" value={stats?.doors_knocked ?? 0} />
          <StatBox label="Contacts" value={stats?.contacts ?? 0} />
          <StatBox label="Appointments" value={stats?.appointments ?? 0} />
          <StatBox
            label="Sales"
            value={stats?.sales ?? 0}
            sub={`${stats?.conversion_pct?.toFixed(1) ?? 0}% conversion`}
          />
        </div>
      </div>

      {data?.team_stats && data.team_stats.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Team Leaderboard</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <p className="text-xs font-medium text-gray-500 mb-3">Quick Actions</p>
          <div className="flex flex-col gap-2">
            <Link href="/map" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
              <span className="text-blue-500">→</span> Open Field Map
            </Link>
            <Link href="/leads" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
              <span className="text-blue-500">→</span> View All Leads
            </Link>
            <Link href="/manager/queue" className="flex items-center gap-2 rounded-xl hover:bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors">
              <span className="text-blue-500">→</span> Manager Review Queue
            </Link>
          </div>
        </Card>

        <Card padding="md">
          <p className="text-xs font-medium text-gray-500 mb-3">AI Usage</p>
          <AIUsageWidget />
        </Card>
      </div>
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
          <span>Today</span>
          <span>{daily} / {dailyMax}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.min((daily / dailyMax) * 100, 100)}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Total cap</span>
          <span>{total} / {totalMax}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-purple-500 transition-all"
            style={{ width: `${Math.min((total / totalMax) * 100, 100)}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-gray-400">Team tiers unlock additional AI prompts</p>
    </div>
  );
}
