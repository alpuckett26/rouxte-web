"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRate, ACTIVATION_FEE, NEXT_UP_FEE, PlanType, DiscountType } from "@/lib/quoting/pricing";

const fmt = (n: number) => `$${n.toFixed(2)}`;
const fmtInput = (n: number) => n === 0 ? "" : String(n);
const parseNum = (s: string) => Math.max(0, parseFloat(s) || 0);

interface QuoteLine {
  line_number: number;
  plan_type: PlanType;
  rate_plan: number;
  plan_promo: number;
  next_up: boolean;
  next_up_amt: number;
  insurance: number;
  retailer_promo: number;
  device: number;
  device_promo: number;
  line_total: number;
}

const PLAN_LABELS: Record<PlanType, string> = {
  premium: "Premium Unlimited",
  extra: "Extra (50GB)",
  starter: "Starter",
};

const DISCOUNT_LABELS: Record<DiscountType, string> = {
  none: "None",
  appreciation: "Appreciation (25% off)",
  signature: "Signature ($10/line off)",
};

const APPRECIATION_TYPES = [
  "Military", "First Responder", "Retired Law Enforcement",
  "Nurse/Healthcare", "Teacher", "Union Member", "Employee", "Other",
];

function buildLines(
  premiumCount: number,
  extraCount: number,
  starterCount: number,
  totalLines: number,
  autopay: boolean,
  discount: DiscountType,
  existing: QuoteLine[],
): QuoteLine[] {
  const plan: PlanType[] = [
    ...Array(premiumCount).fill("premium"),
    ...Array(extraCount).fill("extra"),
    ...Array(starterCount).fill("starter"),
  ];

  return plan.map((p, i) => {
    const prev = existing[i];
    const rate = getRate(p, totalLines, autopay, discount);
    return {
      line_number: i + 1,
      plan_type: p,
      rate_plan: rate,
      plan_promo: prev?.plan_promo ?? 0,
      next_up: prev?.next_up ?? false,
      next_up_amt: NEXT_UP_FEE,
      insurance: prev?.insurance ?? 0,
      retailer_promo: prev?.retailer_promo ?? 0,
      device: prev?.device ?? 0,
      device_promo: prev?.device_promo ?? 0,
      line_total: 0,
    };
  }).map(l => ({ ...l, line_total: calcLineTotal(l) }));
}

function calcLineTotal(l: QuoteLine): number {
  return l.rate_plan
    - l.plan_promo
    + (l.next_up ? l.next_up_amt : 0)
    + l.insurance
    - l.retailer_promo
    + l.device
    - l.device_promo;
}

interface Props {
  leadId?: string;
  initialCustomerName?: string;
}

export default function QuoteBuilder({ leadId, initialCustomerName }: Props) {
  const router = useRouter();

  // Step 1
  const [step, setStep] = useState(1);
  const [customerName, setCustomerName] = useState(initialCustomerName ?? "");
  const [premiumCount, setPremiumCount] = useState(1);
  const [extraCount, setExtraCount] = useState(0);
  const [starterCount, setStarterCount] = useState(0);
  const [autopay, setAutopay] = useState(true);
  const [discount, setDiscount] = useState<DiscountType>("none");
  const [appreciationType, setAppreciationType] = useState("");
  const [portIn, setPortIn] = useState(0);
  const [newLine, setNewLine] = useState(0);
  const [upgrade, setUpgrade] = useState(0);

  // Step 2
  const [lines, setLines] = useState<QuoteLine[]>([]);

  // Saving
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLines = premiumCount + extraCount + starterCount;

  useEffect(() => {
    if (totalLines === 0) return;
    setLines(prev => buildLines(premiumCount, extraCount, starterCount, totalLines, autopay, discount, prev));
  }, [premiumCount, extraCount, starterCount, autopay, discount]);

  function updateLine(i: number, field: keyof QuoteLine, value: number | boolean) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: value };
      return { ...updated, line_total: calcLineTotal(updated) };
    }));
  }

  const monthlyTotal = lines.reduce((s, l) => s + l.line_total, 0);
  const activationFee = (portIn + newLine) * ACTIVATION_FEE;

  async function saveQuote() {
    if (!totalLines) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: leadId ?? null,
        customer_name: customerName || null,
        total_lines: totalLines,
        autopay_paperless: autopay,
        discount_type: discount,
        appreciation_type: appreciationType || null,
        premium_lines: premiumCount,
        extra_lines: extraCount,
        starter_lines: starterCount,
        port_in_lines: portIn,
        new_lines: newLine,
        upgrade_lines: upgrade,
        monthly_total: monthlyTotal,
        activation_fee: activationFee,
        status: "draft",
        lines: lines.map(l => ({
          line_number: l.line_number,
          plan_type: l.plan_type,
          rate_plan: l.rate_plan,
          plan_promo: l.plan_promo,
          next_up: l.next_up,
          next_up_amt: l.next_up_amt,
          insurance: l.insurance,
          retailer_promo: l.retailer_promo,
          device: l.device,
          device_promo: l.device_promo,
          line_total: l.line_total,
        })),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Failed to save"); return; }
    router.push(`/quote/${json.quote.id}`);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">AT&T Wireless Quote</h1>
        <p className="text-sm text-gray-500 mt-1">Build a quote using the AT&T Billing & Quote Worksheet.</p>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 border-b border-gray-100 pb-1">
        {[1, 2, 3].map(s => (
          <button key={s} onClick={() => { if (s < step || (s === 2 && totalLines > 0)) setStep(s); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              step === s ? "bg-blue-50 text-blue-700" : "text-gray-400 hover:text-gray-600"
            }`}>
            {s === 1 ? "Step 1 · Setup" : s === 2 ? "Step 2 · Per Line" : "Step 3 · Summary"}
          </button>
        ))}
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          {/* Customer */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Customer</p>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>

          {/* Plan mix */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Step 1 · Unlimited Your Way — Plan Mix</p>
            <div className="grid grid-cols-3 gap-3">
              {(["premium", "extra", "starter"] as PlanType[]).map(plan => {
                const count = plan === "premium" ? premiumCount : plan === "extra" ? extraCount : starterCount;
                const setCount = plan === "premium" ? setPremiumCount : plan === "extra" ? setExtraCount : setStarterCount;
                return (
                  <div key={plan} className="flex flex-col items-center gap-2">
                    <p className="text-xs font-semibold text-center text-gray-700">{PLAN_LABELS[plan]}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCount(Math.max(0, count - 1))}
                        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">−</button>
                      <span className="text-lg font-bold text-gray-900 w-4 text-center">{count}</span>
                      <button onClick={() => setCount(Math.min(10, count + 1))}
                        className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 transition-colors">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {totalLines > 0 && (
              <p className="text-xs text-center text-gray-400">{totalLines} total line{totalLines !== 1 ? "s" : ""}</p>
            )}
          </div>

          {/* Discounts */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Discounts</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={autopay} onChange={e => setAutopay(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">AutoPay + Paperless Billing</p>
                <p className="text-xs text-gray-400">−$10/line per month</p>
              </div>
            </label>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 font-medium">Plan discount</p>
              {(["none", "appreciation", "signature"] as DiscountType[]).map(d => (
                <label key={d} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="discount" checked={discount === d} onChange={() => setDiscount(d)}
                    className="accent-blue-600" />
                  <span className="text-sm text-gray-700">{DISCOUNT_LABELS[d]}</span>
                </label>
              ))}
            </div>
            {discount === "appreciation" && (
              <select value={appreciationType} onChange={e => setAppreciationType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select type…</option>
                {APPRECIATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>

          {/* Line types */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Port-In / New Line / Upgrade</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Port-In", val: portIn, set: setPortIn },
                { label: "New Line", val: newLine, set: setNewLine },
                { label: "Upgrade", val: upgrade, set: setUpgrade },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <p className="text-xs font-semibold text-gray-600">{label}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => set(Math.max(0, val - 1))}
                      className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">−</button>
                    <span className="text-lg font-bold text-gray-900 w-4 text-center">{val}</span>
                    <button onClick={() => set(Math.min(10, val + 1))}
                      className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold hover:bg-blue-200">+</button>
                  </div>
                </div>
              ))}
            </div>
            {activationFee > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Activation/Upgrade fee: <strong>{fmt(activationFee)}</strong> will appear on first bill
                ({portIn + newLine} line{portIn + newLine !== 1 ? "s" : ""} × $35)
              </p>
            )}
          </div>

          <button
            disabled={totalLines === 0}
            onClick={() => setStep(2)}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
            Build Per-Line Quote →
          </button>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-400">
            Rates auto-calculated · {totalLines} line{totalLines !== 1 ? "s" : ""} ·{" "}
            {autopay ? "AutoPay/Paperless" : "No AutoPay"}{" "}
            {discount !== "none" ? `· ${DISCOUNT_LABELS[discount]}` : ""}
          </p>

          {lines.map((line, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-blue-700">Line {line.line_number}</p>
                  <p className="text-xs text-gray-500">{PLAN_LABELS[line.plan_type]}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{fmt(line.line_total)}</p>
                  <p className="text-xs text-gray-400">per month</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {/* Rate plan — read only */}
                <div className="flex items-center justify-between col-span-2 border-b border-gray-50 pb-2">
                  <span className="text-xs text-gray-500">1. Rate Plan</span>
                  <span className="text-sm font-semibold text-gray-800">{fmt(line.rate_plan)}</span>
                </div>

                {/* Plan promo */}
                <div className="flex items-center justify-between col-span-2">
                  <label className="text-xs text-gray-500">2. Plan Promo</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">−$</span>
                    <input type="number" min="0" step="0.01"
                      value={fmtInput(line.plan_promo)}
                      onChange={e => updateLine(i, "plan_promo", parseNum(e.target.value))}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-200" />
                  </div>
                </div>

                {/* Next Up */}
                <div className="flex items-center justify-between col-span-2">
                  <label className="text-xs text-gray-500">3. Next Up?</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="radio" name={`nextup-${i}`} checked={line.next_up}
                        onChange={() => updateLine(i, "next_up", true)} className="accent-blue-600" />
                      Yes (+$6)
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="radio" name={`nextup-${i}`} checked={!line.next_up}
                        onChange={() => updateLine(i, "next_up", false)} className="accent-blue-600" />
                      No
                    </label>
                  </div>
                </div>

                {/* Insurance */}
                <div className="flex items-center justify-between col-span-2">
                  <label className="text-xs text-gray-500">4. Insurance</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">$</span>
                    <input type="number" min="0" step="0.01"
                      value={fmtInput(line.insurance)}
                      onChange={e => updateLine(i, "insurance", parseNum(e.target.value))}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-200" />
                  </div>
                </div>

                {/* Retailer promo */}
                <div className="flex items-center justify-between col-span-2">
                  <label className="text-xs text-gray-500">5. Retailer Promo</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">−$</span>
                    <input type="number" min="0" step="0.01"
                      value={fmtInput(line.retailer_promo)}
                      onChange={e => updateLine(i, "retailer_promo", parseNum(e.target.value))}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-200" />
                  </div>
                </div>

                {/* Device */}
                <div className="flex items-center justify-between col-span-2">
                  <label className="text-xs text-gray-500">6. Device</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">$</span>
                    <input type="number" min="0" step="0.01"
                      value={fmtInput(line.device)}
                      onChange={e => updateLine(i, "device", parseNum(e.target.value))}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-200" />
                  </div>
                </div>

                {/* Device promo */}
                <div className="flex items-center justify-between col-span-2">
                  <label className="text-xs text-gray-500">7. Device Promo</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">−$</span>
                    <input type="number" min="0" step="0.01"
                      value={fmtInput(line.device_promo)}
                      onChange={e => updateLine(i, "device_promo", parseNum(e.target.value))}
                      className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-200" />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button onClick={() => setStep(3)}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
            Review Summary →
          </button>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          {/* Line totals */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 mb-3">Step 3 · Total For All Lines</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              {lines.map(l => (
                <div key={l.line_number} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Line {l.line_number}</span>
                  <span className="text-sm font-medium text-gray-800">{fmt(l.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Monthly Total</span>
              <span className="text-xl font-bold text-blue-700">{fmt(monthlyTotal)}</span>
            </div>
          </div>

          {/* Expectations */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">Step 4 · Set Expectations</p>
            <ul className="space-y-2 text-xs text-amber-800">
              <li className="flex gap-2">
                <span>📋</span>
                First bill includes a <strong>full month + partial month</strong> depending on activation date.
              </li>
              <li className="flex gap-2">
                <span>⏱️</span>
                Promotions apply within <strong>2–3 billing cycles</strong> after all required steps are completed.
              </li>
              <li className="flex gap-2">
                <span>✅</span>
                Plan promotions require registration at <strong>att.com/signature</strong> once phones are received and activated.
              </li>
              <li className="flex gap-2">
                <span>📱</span>
                Premium Trade-In: devices must be received within <strong>30 days of activation</strong>.
              </li>
              {activationFee > 0 && (
                <li className="flex gap-2">
                  <span>💳</span>
                  Activation/Upgrade fee of <strong>{fmt(activationFee)}</strong> will be on the upcoming bill.
                  If a promo waives it, the credit applies within 3 billing cycles.
                </li>
              )}
            </ul>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Notes (optional)</p>
            <textarea rows={3} placeholder="Any additional notes for this quote…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              ← Edit Lines
            </button>
            <button onClick={saveQuote} disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save & Share Quote →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
