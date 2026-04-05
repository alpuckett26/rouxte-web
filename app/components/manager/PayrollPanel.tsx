"use client";

import { useEffect, useState, useCallback } from "react";

interface PayPeriod {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
}

interface Paystub {
  id: string;
  user_id: string;
  full_name?: string;
  period_start: string;
  period_end: string;
  pay_type: "hourly" | "commission";
  hours_worked: number | null;
  hourly_rate: number | null;
  gross_commission: number;
  chargebacks: number;
  bonus: number;
  net_pay: number;
  sales_count: number;
  status: string;
  approved_at: string | null;
  released_at: string | null;
  manager_notes: string | null;
}

interface Chargeback {
  id: string;
  user_id: string;
  payout_amount: number;
  reason: string | null;
  created_at: string;
  rep?: { full_name?: { full_name?: string } };
}

interface BonusGoal {
  id: string;
  name: string;
  bonus_amount: number;
  target_sales_count: number | null;
  target_revenue: number | null;
  period_type: string;
  active: boolean;
}

export default function PayrollPanel() {
  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [stubs, setStubs] = useState<Paystub[]>([]);
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [bonusGoals, setBonusGoals] = useState<BonusGoal[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PayPeriod | null>(null);
  const [tab, setTab] = useState<"stubs" | "chargebacks" | "bonuses">("stubs");
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");

  // Chargeback form
  const [cbForm, setCbForm] = useState({ user_id: "", payout_amount: "", reason: "" });
  const [cbLoading, setCbLoading] = useState(false);

  // Bonus goal form
  const [bgForm, setBgForm] = useState({ name: "", bonus_amount: "", target_sales_count: "", target_revenue: "", period_type: "weekly" });
  const [bgLoading, setBgLoading] = useState(false);

  // Hours editing
  const [editHours, setEditHours] = useState<Record<string, string>>({});
  const [hoursLoading, setHoursLoading] = useState<Record<string, boolean>>({});

  // Notes editing
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [pRes, sRes, cRes, bRes] = await Promise.all([
      fetch("/api/payroll/periods"),
      fetch("/api/payroll/stubs"),
      fetch("/api/payroll/chargebacks"),
      fetch("/api/bonus-goals"),
    ]);
    const [p, s, c, b] = await Promise.all([pRes.json(), sRes.json(), cRes.json(), bRes.json()]);
    setPeriods(p.data ?? []);
    setStubs(s.data ?? []);
    setChargebacks(c.data ?? []);
    setBonusGoals(b.data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createPeriod = async () => {
    const res = await fetch("/api/payroll/periods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const j = await res.json();
    if (j.data) { setPeriods((prev) => [j.data, ...prev]); setSelectedPeriod(j.data); }
  };

  const generate = async () => {
    if (!selectedPeriod) return;
    setGenerating(true);
    setMsg("");
    const res = await fetch(`/api/payroll/periods/${selectedPeriod.id}/generate`, { method: "POST" });
    const j = await res.json();
    setGenerating(false);
    if (j.stubs_generated !== undefined) {
      setMsg(`Generated ${j.stubs_generated} stub${j.stubs_generated !== 1 ? "s" : ""}`);
      await load();
    } else {
      setMsg(j.error ?? "Error");
    }
  };

  const patchStub = async (id: string, body: object) => {
    const res = await fetch(`/api/payroll/stubs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (j.data) setStubs((prev) => prev.map((s) => s.id === id ? { ...s, ...j.data } : s));
    return j;
  };

  const saveHours = async (stub: Paystub) => {
    const hours = parseFloat(editHours[stub.id] ?? "");
    if (isNaN(hours)) return;
    setHoursLoading((h) => ({ ...h, [stub.id]: true }));
    await patchStub(stub.id, { hours_worked: hours });
    setHoursLoading((h) => ({ ...h, [stub.id]: false }));
    setEditHours((h) => { const n = { ...h }; delete n[stub.id]; return n; });
  };

  const saveNotes = async (stubId: string) => {
    await patchStub(stubId, { manager_notes: editNotes[stubId] ?? "" });
    setEditNotes((n) => { const copy = { ...n }; delete copy[stubId]; return copy; });
  };

  const submitChargeback = async (e: React.FormEvent) => {
    e.preventDefault();
    setCbLoading(true);
    const res = await fetch("/api/payroll/chargebacks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: cbForm.user_id,
        payout_amount: parseFloat(cbForm.payout_amount),
        reason: cbForm.reason || null,
      }),
    });
    const j = await res.json();
    setCbLoading(false);
    if (j.data) {
      setCbForm({ user_id: "", payout_amount: "", reason: "" });
      await load();
    }
  };

  const submitBonusGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setBgLoading(true);
    const res = await fetch("/api/bonus-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: bgForm.name,
        bonus_amount: parseFloat(bgForm.bonus_amount),
        target_sales_count: bgForm.target_sales_count ? parseInt(bgForm.target_sales_count) : null,
        target_revenue: bgForm.target_revenue ? parseFloat(bgForm.target_revenue) : null,
        period_type: bgForm.period_type,
      }),
    });
    const j = await res.json();
    setBgLoading(false);
    if (j.data) {
      setBgForm({ name: "", bonus_amount: "", target_sales_count: "", target_revenue: "", period_type: "weekly" });
      await load();
    }
  };

  const toggleBonusGoal = async (goal: BonusGoal) => {
    await fetch("/api/bonus-goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: goal.id, active: !goal.active }),
    });
    await load();
  };

  const periodStubs = selectedPeriod
    ? stubs.filter((s) => s.period_start === selectedPeriod.period_start)
    : [];

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_approval: "bg-yellow-100 text-yellow-700",
      approved: "bg-blue-100 text-blue-700",
      released: "bg-green-100 text-green-700",
    };
    const labels: Record<string, string> = {
      pending_approval: "Pending",
      approved: "Approved",
      released: "Released",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
        {labels[status] ?? status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Pay Period Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Pay Periods</h2>
          <button
            onClick={createPeriod}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Period
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedPeriod(p); setTab("stubs"); }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedPeriod?.id === p.id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {fmtDate(p.period_start)} – {fmtDate(p.period_end)}
              <span className={`ml-1.5 text-xs ${p.status === "closed" ? "text-gray-400" : "text-green-600"}`}>
                {p.status}
              </span>
            </button>
          ))}
          {periods.length === 0 && (
            <p className="text-sm text-gray-400">No pay periods yet — create one to get started.</p>
          )}
        </div>
      </div>

      {/* Period Actions */}
      {selectedPeriod && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                {fmtDate(selectedPeriod.period_start)} – {fmtDate(selectedPeriod.period_end)}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{periodStubs.length} stub{periodStubs.length !== 1 ? "s" : ""} generated</p>
            </div>
            <div className="flex items-center gap-3">
              {msg && <span className="text-sm text-green-600">{msg}</span>}
              <button
                onClick={generate}
                disabled={generating}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate Stubs"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 pb-1">
        {(["stubs", "chargebacks", "bonuses"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t === "stubs" ? "Paystubs" : t === "chargebacks" ? "Chargebacks" : "Bonus Goals"}
          </button>
        ))}
      </div>

      {/* Stubs Tab */}
      {tab === "stubs" && (
        <div className="space-y-3">
          {(selectedPeriod ? periodStubs : stubs).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {selectedPeriod ? "No stubs for this period — click Generate Stubs." : "Select a pay period to view stubs."}
            </p>
          ) : (
            (selectedPeriod ? periodStubs : stubs).map((stub) => (
              <div key={stub.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{stub.full_name ?? stub.user_id}</p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{stub.pay_type} pay · {stub.sales_count} sale{stub.sales_count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(stub.status)}
                    <a
                      href={`/payroll/stubs/${stub.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                    >
                      View
                    </a>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-gray-500">Commission</span>
                    <p className="font-medium">{fmt(stub.gross_commission)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Chargebacks</span>
                    <p className="font-medium text-red-600">-{fmt(stub.chargebacks)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Bonus</span>
                    <p className="font-medium text-green-600">+{fmt(stub.bonus)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Net Pay</span>
                    <p className="font-semibold text-lg">{fmt(stub.net_pay)}</p>
                  </div>
                </div>

                {/* Hours entry for hourly reps */}
                {stub.pay_type === "hourly" && stub.status === "pending_approval" && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-sm text-gray-600">Hours worked:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={editHours[stub.id] ?? (stub.hours_worked?.toString() ?? "")}
                      onChange={(e) => setEditHours((h) => ({ ...h, [stub.id]: e.target.value }))}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => saveHours(stub)}
                      disabled={hoursLoading[stub.id]}
                      className="rounded-lg bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {hoursLoading[stub.id] ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}

                {/* Notes */}
                {stub.status !== "released" && (
                  <div className="mt-3">
                    <input
                      type="text"
                      placeholder="Manager notes (optional)"
                      value={editNotes[stub.id] ?? (stub.manager_notes ?? "")}
                      onChange={(e) => setEditNotes((n) => ({ ...n, [stub.id]: e.target.value }))}
                      onBlur={() => { if (editNotes[stub.id] !== undefined) saveNotes(stub.id); }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Actions */}
                {stub.status === "pending_approval" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => patchStub(stub.id, { status: "approved" })}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Approve
                    </button>
                  </div>
                )}
                {stub.status === "approved" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => patchStub(stub.id, { status: "released" })}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Release to Rep
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Chargebacks Tab */}
      {tab === "chargebacks" && (
        <div className="space-y-4">
          {/* New chargeback form */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Record Chargeback</h3>
            <form onSubmit={submitChargeback} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rep User ID</label>
                <input
                  required
                  type="text"
                  value={cbForm.user_id}
                  onChange={(e) => setCbForm((f) => ({ ...f, user_id: e.target.value }))}
                  placeholder="user-uuid"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Payout Clawback ($)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={cbForm.payout_amount}
                  onChange={(e) => setCbForm((f) => ({ ...f, payout_amount: e.target.value }))}
                  placeholder="500.00"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reason</label>
                <input
                  type="text"
                  value={cbForm.reason}
                  onChange={(e) => setCbForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Customer cancelled within 30 days"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={cbLoading}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cbLoading ? "Saving…" : "Record"}
              </button>
            </form>
          </div>

          {/* Unapplied chargebacks */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="px-4 py-3">
              <h3 className="font-semibold text-gray-900">Unapplied Chargebacks</h3>
              <p className="text-xs text-gray-500 mt-0.5">Will be deducted on the next generated stub.</p>
            </div>
            {chargebacks.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-400">None pending.</div>
            ) : (
              chargebacks.map((cb) => (
                <div key={cb.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cb.reason ?? "Sale reversal"}</p>
                    <p className="text-xs text-gray-500">{new Date(cb.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="font-semibold text-red-600">-{fmt(cb.payout_amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bonus Goals Tab */}
      {tab === "bonuses" && (
        <div className="space-y-4">
          {/* New bonus goal form */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Add Bonus Goal</h3>
            <form onSubmit={submitBonusGoal} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  required
                  type="text"
                  value={bgForm.name}
                  onChange={(e) => setBgForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="10-sale sprint bonus"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bonus ($)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={bgForm.bonus_amount}
                  onChange={(e) => setBgForm((f) => ({ ...f, bonus_amount: e.target.value }))}
                  placeholder="250.00"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min Sales</label>
                <input
                  type="number"
                  min="0"
                  value={bgForm.target_sales_count}
                  onChange={(e) => setBgForm((f) => ({ ...f, target_sales_count: e.target.value }))}
                  placeholder="10"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min Revenue ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bgForm.target_revenue}
                  onChange={(e) => setBgForm((f) => ({ ...f, target_revenue: e.target.value }))}
                  placeholder="optional"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Period</label>
                <select
                  value={bgForm.period_type}
                  onChange={(e) => setBgForm((f) => ({ ...f, period_type: e.target.value }))}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={bgLoading}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {bgLoading ? "Saving…" : "Add"}
              </button>
            </form>
          </div>

          {/* Existing goals */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="px-4 py-3">
              <h3 className="font-semibold text-gray-900">Active Bonus Goals</h3>
              <p className="text-xs text-gray-500 mt-0.5">Applied automatically when generating stubs.</p>
            </div>
            {bonusGoals.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-400">No bonus goals yet.</div>
            ) : (
              bonusGoals.map((goal) => (
                <div key={goal.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{goal.name}</p>
                    <p className="text-xs text-gray-500">
                      {goal.target_sales_count != null ? `≥${goal.target_sales_count} sales` : ""}
                      {goal.target_sales_count != null && goal.target_revenue != null ? " · " : ""}
                      {goal.target_revenue != null ? `≥${fmt(goal.target_revenue)} revenue` : ""}
                      {" · "}{goal.period_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-green-600">{fmt(goal.bonus_amount)}</span>
                    <button
                      onClick={() => toggleBonusGoal(goal)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        goal.active
                          ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                          : "bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700"
                      }`}
                    >
                      {goal.active ? "Active" : "Off"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
