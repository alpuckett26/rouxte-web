"use client";

import { useEffect, useState } from "react";

interface FunnelRow {
  rep_id: string;
  full_name: string;
  slug: string;
  funnel_name: string;
  active: boolean;
  scan_count: number;
  total_submissions: number;
  hot_count: number;
  warm_count: number;
  cold_count: number;
  last_submission_at: string | null;
}

function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SmartPitchManagerPanel() {
  const [rows, setRows]   = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupUrl, setBackupUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/manager/funnels")
      .then(r => r.json())
      .then(d => { setRows(d.data ?? []); setBackupUrl(d.org_backup_url ?? ""); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">SmartPitch — Team Funnels</h1>
        <p className="text-sm text-gray-500 mt-1">
          {rows.length} rep{rows.length !== 1 ? "s" : ""} with active funnels
        </p>
      </div>

      {backupUrl && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 px-5 py-4">
          <p className="text-sm font-semibold text-gray-900">🔋 Org-wide Backup Power page</p>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            Use this link in Meta and Google ads. Leads land unassigned in your org&apos;s lead pool and managers get an alert to dispatch them.
            Add UTM tags (e.g. <code>?utm_source=meta&amp;utm_campaign=storm</code>) — they&apos;re saved on each lead.
          </p>
          <div className="flex gap-2">
            <span className="flex-1 min-w-0 truncate rounded-xl bg-white border border-gray-200 px-3 py-2 text-xs text-gray-500">{backupUrl}</span>
            <button
              onClick={async () => { await navigator.clipboard.writeText(backupUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <a href={backupUrl} target="_blank" rel="noopener noreferrer"
              className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600">
              Preview →
            </a>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm text-gray-400">No reps have activated SmartPitch yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rep</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Scans</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Leads</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-red-500 uppercase tracking-wide">🔥 Hot</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-amber-500 uppercase tracking-wide">♨️ Warm</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">🧊 Cold</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.rep_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.full_name}</p>
                    <p className="text-xs text-gray-400">{r.funnel_name}</p>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700 font-medium">{r.scan_count}</td>
                  <td className="px-4 py-3 text-center text-gray-700 font-bold">{r.total_submissions}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-bold">{r.hot_count}</td>
                  <td className="px-4 py-3 text-center text-amber-600 font-bold">{r.warm_count}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{r.cold_count}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(r.last_submission_at)}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/r/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline font-mono"
                    >
                      /r/{r.slug}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
