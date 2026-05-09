"use client";

import { useEffect, useState } from "react";

interface Submission {
  id: string;
  customer_name: string;
  phone: string;
  lead_score: number;
  lead_temperature: "hot" | "warm" | "cold";
  recommended_pitch: string;
  service_interest: string;
  current_provider: string;
  switch_timeline: string;
  created_at: string;
}

interface Funnel {
  id: string;
  slug: string;
  funnel_name: string;
  active: boolean;
  scan_count: number;
  created_at: string;
}

interface Stats { total: number; hot: number; warm: number; cold: number }

const TEMP_STYLE: Record<string, string> = {
  hot:  "bg-red-100 text-red-700 border border-red-200",
  warm: "bg-amber-100 text-amber-700 border border-amber-200",
  cold: "bg-gray-100 text-gray-500 border border-gray-200",
};

const TEMP_LABEL: Record<string, string> = { hot: "🔥 Hot", warm: "♨️ Warm", cold: "🧊 Cold" };

const SERVICE_LABELS: Record<string, string> = {
  fiber: "Fiber", wireless: "Wireless", bundle: "Bundle", business: "Business", unsure: "Not sure",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SmartPitchDashboard() {
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Submission[]>([]);
  const [qr, setQr]         = useState<string | null>(null);
  const [funnelUrl, setFunnelUrl] = useState<string>("");
  const [creating, setCreating]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/rep/smartpitch");
    if (res.ok) {
      const data = await res.json();
      setFunnel(data.funnel);
      setStats(data.stats);
      setRecent(data.recent ?? []);
      setQr(data.qr_data_url);
      setFunnelUrl(data.funnel_url ?? "");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createFunnel() {
    setCreating(true);
    const res = await fetch("/api/rep/smartpitch", { method: "POST" });
    if (res.ok) await load();
    setCreating(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(funnelUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">SmartPitch</h1>
        <p className="text-sm text-gray-500 mt-1">Your personal lead funnel — share your link and turn every door into an opportunity.</p>
      </div>

      {!funnel ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <p className="text-base font-semibold text-gray-900 mb-1">Set up your SmartPitch Funnel</p>
          <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
            Get a unique link and QR code you can put on door hangers, texts, or social posts.
            Every scan and quiz submission becomes a scored lead in your CRM.
          </p>
          <button
            onClick={createFunnel}
            disabled={creating}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "Create My Funnel →"}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
            <div className="flex gap-5 items-start">
              {qr && (
                <div className="flex-shrink-0 rounded-xl overflow-hidden border border-gray-100 p-2 bg-white shadow-sm">
                  <img src={qr} alt="QR code" className="h-24 w-24" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 mb-1">{funnel.funnel_name}</p>
                <p className="text-xs text-gray-400 mb-3">{funnel.scan_count} scan{funnel.scan_count !== 1 ? "s" : ""} so far</p>
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2 mb-3">
                  <span className="text-xs text-gray-500 truncate flex-1">{funnelUrl}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyLink}
                    className="flex-1 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {copied ? "✓ Copied!" : "Copy Link"}
                  </button>
                  <a
                    href={funnelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl bg-[#0a0f1e] py-2 text-xs font-semibold text-white text-center hover:bg-[#1a2035] transition-colors"
                  >
                    Preview →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total", value: stats.total, color: "text-gray-900" },
                { label: "🔥 Hot",  value: stats.hot,   color: "text-red-600" },
                { label: "♨️ Warm", value: stats.warm,  color: "text-amber-600" },
                { label: "🧊 Cold", value: stats.cold,  color: "text-gray-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl border border-gray-200 bg-white px-3 py-4 text-center">
                  <p className={`text-2xl font-black ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Recent Funnel Leads</p>
            </div>
            {recent.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-gray-400">No leads yet — share your link to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recent.map(sub => (
                  <div key={sub.id}>
                    <button
                      onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">{sub.customer_name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TEMP_STYLE[sub.lead_temperature]}`}>
                            {TEMP_LABEL[sub.lead_temperature]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{SERVICE_LABELS[sub.service_interest] ?? sub.service_interest}</span>
                          <span>·</span>
                          <span>{sub.phone}</span>
                          <span>·</span>
                          <span>{timeAgo(sub.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-lg font-black text-gray-900">{sub.lead_score}</p>
                        <p className="text-[10px] text-gray-400">score</p>
                      </div>
                      <svg className={`h-4 w-4 text-gray-300 flex-shrink-0 transition-transform ${expanded === sub.id ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expanded === sub.id && (
                      <div className="px-5 pb-4 pt-1 bg-blue-50 border-t border-blue-100">
                        <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide mb-1">Recommended Pitch</p>
                        <p className="text-xs text-blue-900 leading-relaxed">{sub.recommended_pitch}</p>
                        <a href={`tel:${sub.phone}`}
                          className="inline-block mt-3 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors">
                          Call {sub.customer_name.split(" ")[0]}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
