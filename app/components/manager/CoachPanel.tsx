"use client";

import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";

// ── Types ──────────────────────────────────────────────────────────────────
interface Competitor {
  id: string;
  competitor: string;
  plan_name: string;
  monthly_price: number | null;
  download_mbps: number | null;
  upload_mbps: number | null;
  contract_required: boolean;
  data_cap_gb: number | null;
  notes: string | null;
  org_id: string | null;
}

interface QA {
  id: string;
  trigger: string;
  response: string;
  category: string;
  use_count: number;
}

const CATEGORIES = [
  { value: "objection", label: "Objection" },
  { value: "pitch", label: "Pitch" },
  { value: "closing", label: "Closing" },
  { value: "product", label: "Product" },
];

const CAT_COLORS: Record<string, string> = {
  objection: "bg-red-50 text-red-700 border-red-200",
  pitch:     "bg-blue-50 text-blue-700 border-blue-200",
  closing:   "bg-green-50 text-green-700 border-green-200",
  product:   "bg-purple-50 text-purple-700 border-purple-200",
};

// ── Main panel ─────────────────────────────────────────────────────────────
export default function CoachPanel() {
  const [tab, setTab] = useState<"qa" | "competitors">("qa");

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">AI Coach Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Build the knowledge base your AI coach draws from when helping reps in the field.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-100 pb-1">
        {([
          { key: "qa", label: "Objection & Script Bank" },
          { key: "competitors", label: "Competitor Intel" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "qa" ? <QABank /> : <CompetitorIntel />}
    </div>
  );
}

// ── Q&A Bank ───────────────────────────────────────────────────────────────
function QABank() {
  const [items, setItems] = useState<QA[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ trigger: "", response: "", category: "objection" });

  const fetch_ = useCallback(async () => {
    const res = await fetch("/api/coach/qa");
    const d = await res.json();
    setItems(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function save() {
    if (!form.trigger.trim() || !form.response.trim()) return;
    setSaving(true);
    await fetch("/api/coach/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ trigger: "", response: "", category: "objection" });
    setAdding(false);
    await fetch_();
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch(`/api/coach/qa/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Add proven scripts and rebuttals. The AI coach references these when reps ask for help at the door.
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>+ Add Script</Button>
      </div>

      {adding && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setForm((f) => ({ ...f, category: c.value }))}
                className={`rounded-lg px-3 py-1 text-xs font-medium border transition-colors ${
                  form.category === c.value ? CAT_COLORS[c.value] : "border-gray-200 text-gray-500 bg-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            value={form.trigger}
            onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
            placeholder='When the customer says... (e.g. "I already have Spectrum")'
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <textarea
            value={form.response}
            onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))}
            placeholder="The proven response or script to use..."
            rows={3}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
          />
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} size="sm">{saving ? "Saving…" : "Save"}</Button>
            <button onClick={() => setAdding(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">No scripts yet. Add your first proven rebuttal or pitch.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {CATEGORIES.filter((c) => items.some((i) => i.category === c.value)).map((cat) => (
            <div key={cat.value}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat.label}s</p>
              <div className="flex flex-col gap-2">
                {items.filter((i) => i.category === cat.value).map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 mb-1">"{item.trigger}"</p>
                        <p className="text-sm text-gray-800">{item.response}</p>
                        {item.use_count > 0 && (
                          <p className="text-xs text-gray-400 mt-1">Used {item.use_count} time{item.use_count !== 1 ? "s" : ""} by coach</p>
                        )}
                      </div>
                      <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none shrink-0">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Competitor Intel ───────────────────────────────────────────────────────
function CompetitorIntel() {
  const [items, setItems] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    competitor: "", plan_name: "", monthly_price: "", download_mbps: "",
    upload_mbps: "", contract_required: false, data_cap_gb: "", notes: "",
  });

  const fetch_ = useCallback(async () => {
    const res = await fetch("/api/coach/competitors");
    const d = await res.json();
    setItems(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function save() {
    if (!form.competitor.trim() || !form.plan_name.trim()) return;
    setSaving(true);
    await fetch("/api/coach/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitor: form.competitor,
        plan_name: form.plan_name,
        monthly_price: form.monthly_price ? parseFloat(form.monthly_price) : null,
        download_mbps: form.download_mbps ? parseInt(form.download_mbps) : null,
        upload_mbps: form.upload_mbps ? parseInt(form.upload_mbps) : null,
        contract_required: form.contract_required,
        data_cap_gb: form.data_cap_gb ? parseInt(form.data_cap_gb) : null,
        notes: form.notes || null,
      }),
    });
    setForm({ competitor: "", plan_name: "", monthly_price: "", download_mbps: "", upload_mbps: "", contract_required: false, data_cap_gb: "", notes: "" });
    setAdding(false);
    await fetch_();
    setSaving(false);
  }

  async function remove(id: string, isGlobal: boolean) {
    if (isGlobal) return; // Can't delete global defaults
    await fetch(`/api/coach/competitors/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const grouped = [...new Set(items.map((i) => i.competitor))].map((comp) => ({
    name: comp,
    plans: items.filter((i) => i.competitor === comp),
  }));

  const fmt = (n: number | null) => n != null ? `$${n}/mo` : "—";
  const speed = (d: number | null, u: number | null) =>
    d != null ? `${d >= 1000 ? `${d/1000}G` : `${d}M`} ↓ / ${u != null ? (u >= 1000 ? `${u/1000}G` : `${u}M`) : "?"} ↑` : "—";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Pre-loaded with current market pricing. Add custom plans or update pricing as it changes.
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>+ Add Plan</Button>
      </div>

      {adding && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={form.competitor} onChange={(e) => setForm((f) => ({ ...f, competitor: e.target.value }))}
              placeholder="Competitor (e.g. Spectrum)" className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none" />
            <input value={form.plan_name} onChange={(e) => setForm((f) => ({ ...f, plan_name: e.target.value }))}
              placeholder="Plan name" className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none" />
            <input value={form.monthly_price} onChange={(e) => setForm((f) => ({ ...f, monthly_price: e.target.value }))}
              placeholder="$/mo" type="number" className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none" />
            <input value={form.download_mbps} onChange={(e) => setForm((f) => ({ ...f, download_mbps: e.target.value }))}
              placeholder="Download Mbps" type="number" className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none" />
            <input value={form.upload_mbps} onChange={(e) => setForm((f) => ({ ...f, upload_mbps: e.target.value }))}
              placeholder="Upload Mbps" type="number" className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none" />
            <input value={form.data_cap_gb} onChange={(e) => setForm((f) => ({ ...f, data_cap_gb: e.target.value }))}
              placeholder="Data cap GB (blank = unlimited)" type="number" className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none" />
          </div>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes for the AI coach (e.g. price increases after promo, asymmetric upload...)"
            rows={2} className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none resize-none" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.contract_required} onChange={(e) => setForm((f) => ({ ...f, contract_required: e.target.checked }))} />
            Requires contract
          </label>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} size="sm">{saving ? "Saving…" : "Save"}</Button>
            <button onClick={() => setAdding(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">{[1,2,3].map((i) => <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map((group) => (
            <div key={group.name}>
              <div className="flex items-center gap-2 mb-2">
                <p className={`text-sm font-semibold ${group.name === "AT&T Fiber" ? "text-blue-700" : "text-gray-700"}`}>{group.name}</p>
                {group.name === "AT&T Fiber" && <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-medium">Our Product</span>}
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400">
                      <th className="px-3 py-2 text-left font-medium">Plan</th>
                      <th className="px-3 py-2 text-left font-medium">Price</th>
                      <th className="px-3 py-2 text-left font-medium">Speed</th>
                      <th className="px-3 py-2 text-left font-medium">Data Cap</th>
                      <th className="px-3 py-2 text-left font-medium">Contract</th>
                      <th className="px-3 py-2 w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.plans.map((plan) => (
                      <tr key={plan.id} className="bg-white hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-800">{plan.plan_name}</td>
                        <td className="px-3 py-2.5 text-gray-700">{fmt(plan.monthly_price)}</td>
                        <td className="px-3 py-2.5 text-gray-600">{speed(plan.download_mbps, plan.upload_mbps)}</td>
                        <td className="px-3 py-2.5">
                          {plan.data_cap_gb ? <span className="text-red-600">{plan.data_cap_gb}GB cap</span> : <span className="text-green-600">Unlimited</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {plan.contract_required ? <span className="text-orange-600">Yes</span> : <span className="text-gray-400">No</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {!plan.org_id ? (
                            <span className="text-gray-300 text-xs">Default</span>
                          ) : (
                            <button onClick={() => remove(plan.id, !plan.org_id)} className="text-gray-300 hover:text-red-400 text-base leading-none">×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
