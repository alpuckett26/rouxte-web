"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/utils/leads";
import { LOG_EVENT_LABELS } from "@/lib/utils/logs";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import type { LeadStatus, LogEventType } from "@/lib/types";

interface RepDrillDown {
  profile: {
    user_id: string;
    full_name: string;
    role: string;
    team_id: string | null;
    avatar_url: string | null;
    created_at: string;
    total_sales_count: number | null;
    graduated_at: string | null;
    phone: string | null;
    territory: string | null;
  };
  leads: Array<{
    id: string;
    address: string;
    status: LeadStatus;
    updated_at: string;
    customer_name: string | null;
    assigned_at: string | null;
  }>;
  status_mix: Record<string, number>;
  last_7d: { total_events: number; counts: Record<string, number> };
  recent_activity: Array<{
    id: string;
    event_type: LogEventType;
    summary: string | null;
    ts: string;
    lead_id: string | null;
    is_incident: boolean;
  }>;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", sales_manager: "Manager", team_lead: "Team Lead", sales_rep: "Sales Rep",
};

export default function RepDrillDownClient({ targetUserId }: { targetUserId: string }) {
  const [data, setData] = useState<RepDrillDown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/manager/reps/${targetUserId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setData(j.data ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [targetUserId]);

  if (error) {
    return <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>;
  }
  if (!data) {
    return <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />;
  }

  const sales7d  = data.last_7d.counts["sale_submitted"] ?? 0;
  const quotes7d = data.last_7d.counts["quote_sent"]     ?? 0;
  const knocks7d = data.last_7d.counts["door_knock"]     ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link href="/manager/team" className="text-sm text-gray-500 hover:text-gray-700">← Team</Link>
        <div className="mt-2 flex items-center gap-4">
          <Avatar name={data.profile.full_name} url={data.profile.avatar_url} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{data.profile.full_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge label={ROLE_LABEL[data.profile.role] ?? data.profile.role} color="blue" />
              {data.profile.graduated_at && <Badge label="Graduated" color="green" />}
              {data.profile.phone && <span className="text-xs text-gray-500">{data.profile.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 7-day pulse */}
      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Sales (7d)"  value={sales7d}  tone="green" />
        <Stat label="Quotes (7d)" value={quotes7d} tone="blue" />
        <Stat label="Doors (7d)"  value={knocks7d} tone="purple" />
        <Stat label="Lifetime sales" value={data.profile.total_sales_count ?? 0} tone="amber" />
      </div>

      {/* Status mix */}
      <Card padding="md">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Assigned pipeline</div>
        {Object.keys(data.status_mix).length === 0 ? (
          <p className="text-sm text-gray-500">No leads assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.status_mix).map(([status, count]) => (
              <div key={status} className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
                <Badge label={LEAD_STATUS_LABELS[status as LeadStatus] ?? status}
                       color={LEAD_STATUS_COLORS[status as LeadStatus] ?? "gray"} dot />
                <span className="ml-2 font-mono tabular-nums text-gray-700">{count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Assigned leads (100 most recent) */}
      <Card padding="md">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Recent leads</div>
        {data.leads.length === 0 ? (
          <p className="text-sm text-gray-500">No leads.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <tr>
                <th className="py-2">Address</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.leads.slice(0, 25).map((l) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-2">
                    <div className="font-medium text-gray-900 truncate">{l.address}</div>
                    {l.customer_name && <div className="text-xs text-gray-500">{l.customer_name}</div>}
                  </td>
                  <td><Badge label={LEAD_STATUS_LABELS[l.status]} color={LEAD_STATUS_COLORS[l.status]} dot /></td>
                  <td className="text-xs text-gray-500">{fmtDate(l.updated_at)}</td>
                  <td>
                    <Link href={`/leads/${l.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data.leads.length > 25 && (
          <p className="mt-3 text-xs text-gray-400">Showing 25 of {data.leads.length}. <Link href={`/leads?assigned_to=${data.profile.user_id}`} className="text-blue-600 hover:underline">View all on /leads →</Link></p>
        )}
      </Card>

      {/* Last 7d activity */}
      <Card padding="md">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
          Last 7 days · {data.last_7d.total_events} event{data.last_7d.total_events === 1 ? "" : "s"}
        </div>
        {data.recent_activity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity in the last 7 days.</p>
        ) : (
          <div className="space-y-1 text-xs">
            {data.recent_activity.map((e) => (
              <div key={e.id} className="flex gap-3 py-1.5 border-b border-gray-50 last:border-b-0">
                <span className="text-gray-400 font-mono w-32 shrink-0">{fmtTime(e.ts)}</span>
                <span className={["w-44 shrink-0 font-semibold", e.is_incident ? "text-red-700" : "text-gray-700"].join(" ")}>
                  {LOG_EVENT_LABELS[e.event_type] ?? e.event_type}
                </span>
                <span className="text-gray-600 truncate">{e.summary ?? <span className="text-gray-400">—</span>}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="w-16 h-16 rounded-2xl object-cover" />;
  }
  return (
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white text-2xl font-black flex items-center justify-center">
      {name?.charAt(0) ?? "?"}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "green" | "blue" | "purple" | "amber" }) {
  const accent: Record<string, string> = {
    green: "text-green-700", blue: "text-blue-700", purple: "text-purple-700", amber: "text-amber-700",
  };
  return (
    <Card padding="md">
      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent[tone]} tabular-nums`}>{value}</div>
    </Card>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
