"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import Card from "@/components/ui/Card";

type Range = "7d" | "30d" | "90d" | "1y";

interface Series { date: string; sales: number; quotes_sent: number; wireless_attached: number }
interface Totals {
  sales: number;
  quotes_sent: number;
  wireless_attached: number;
  attach_rate_pct: number;
  by_speed: Record<string, number>;
  by_category: Record<string, number>;
  by_quote_type: Record<string, number>;
}
interface ApiResp { range: Range; series: Series[]; totals: Totals }

const RANGES: { key: Range; label: string }[] = [
  { key: "7d",  label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "1y",  label: "1 year" },
];

const SPEED_COLORS  = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#94a3b8"];
const TYPE_COLORS   = ["#3b82f6", "#10b981"];

export default function AnalyticsClient() {
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<ApiResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/analytics/sales-history?range=${range}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else { setError(null); setData(j); }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [range]);

  const speedData = data
    ? Object.entries(data.totals.by_speed).map(([name, value]) => ({ name: speedLabel(name), value }))
    : [];
  const quoteTypeData = data
    ? Object.entries(data.totals.by_quote_type).map(([name, value]) => ({ name: capitalize(name), value }))
    : [];
  const categoryData = data
    ? Object.entries(data.totals.by_category).map(([name, value]) => ({ name: categoryLabel(name), value }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Sales, quotes, and bundle attach rate over time.</p>
        </div>
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {RANGES.map((r) => (
            <button key={r.key} type="button" onClick={() => setRange(r.key)}
              className={[
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition",
                range === r.key ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900",
              ].join(" ")}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!data ? (
        <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid sm:grid-cols-4 gap-4">
            <KPICard label="Sales"          value={data.totals.sales}             tone="green" />
            <KPICard label="Quotes sent"    value={data.totals.quotes_sent}       tone="blue" />
            <KPICard label="Bundle attach"  value={`${data.totals.attach_rate_pct}%`} tone="purple" sub={`${data.totals.wireless_attached} bundled`} />
            <KPICard label="Total signals"  value={data.totals.sales + data.totals.quotes_sent} tone="amber" sub="sales + quotes" />
          </div>

          {/* Time series bar */}
          <Card padding="md">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Daily activity
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={shortDate} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(v) => shortDate(String(v))} />
                <Legend />
                <Bar dataKey="sales"        name="Sales"  fill="#10b981" />
                <Bar dataKey="quotes_sent"  name="Quotes" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Donuts row */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card padding="md">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Sales by speed tier
              </div>
              {speedData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={speedData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {speedData.map((_, i) => <Cell key={i} fill={SPEED_COLORS[i % SPEED_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card padding="md">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Quotes by type
              </div>
              {quoteTypeData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={quoteTypeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {quoteTypeData.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* Category breakdown */}
          <Card padding="md">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Sales by package category
            </div>
            {categoryData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" name="Sales" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function KPICard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone: "green" | "blue" | "purple" | "amber" }) {
  const accent: Record<string, string> = {
    green:  "text-green-700",
    blue:   "text-blue-700",
    purple: "text-purple-700",
    amber:  "text-amber-700",
  };
  return (
    <Card padding="md">
      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${accent[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
      No data for this range yet.
    </div>
  );
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function speedLabel(key: string): string {
  if (key === "5000+") return "5 Gbps+";
  if (key === "2000")  return "2 Gbps";
  if (key === "1000")  return "1 Gbps";
  if (key === "500")   return "500 Mbps";
  if (key === "300")   return "300 Mbps";
  if (key === "unknown") return "Unspecified";
  return "Other";
}

function categoryLabel(key: string): string {
  const map: Record<string, string> = {
    new:       "Internet — New Install",
    migration: "Internet — Migration",
    mobility:  "Mobile — New Line",
    insurance: "Mobile Insurance",
    other:     "Other",
  };
  return map[key] ?? capitalize(key);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
