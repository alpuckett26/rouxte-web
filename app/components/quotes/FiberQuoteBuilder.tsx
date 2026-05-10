"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIBER_PLANS,
  FiberPlanId,
  getFiberRate,
  WIRELESS_BUNDLE_DISCOUNT_PCT,
} from "@/lib/quoting/fiber-pricing";

const fmt = (n: number) => `$${n.toFixed(2)}`;

interface Props {
  leadId?: string;
  initialCustomerName?: string;
}

const FIBER_PLAN_GROUPS: { label: string; ids: FiberPlanId[] }[] = [
  {
    label: "Fiber Internet",
    ids: ["internet_300", "internet_500", "internet_1gig", "internet_2gig", "internet_5gig"],
  },
  {
    label: "Other Options",
    ids: ["internet_air", "access"],
  },
];

export default function FiberQuoteBuilder({ leadId, initialCustomerName }: Props) {
  const router = useRouter();

  const [step,           setStep]           = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState<FiberPlanId | null>(null);
  const [autopay,        setAutopay]        = useState(true);
  const [wirelessBundle, setWirelessBundle] = useState(false);
  const [customerName,   setCustomerName]   = useState(initialCustomerName ?? "");
  const [customerEmail,  setCustomerEmail]  = useState("");
  const [promoNote,      setPromoNote]      = useState("");
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const plan        = selectedPlanId ? FIBER_PLANS.find(p => p.id === selectedPlanId) ?? null : null;
  const isAccess    = selectedPlanId === "access";
  const bundleOn    = wirelessBundle && !isAccess;
  const rate        = plan ? getFiberRate(selectedPlanId!, autopay, bundleOn) : 0;

  const autopayDiscount = plan && autopay && !isAccess ? plan.basePrice - plan.autopayPrice : 0;
  const bundleBase      = autopay ? (plan?.autopayPrice ?? 0) : (plan?.basePrice ?? 0);
  const bundleDiscount  = bundleOn ? parseFloat((bundleBase * WIRELESS_BUNDLE_DISCOUNT_PCT).toFixed(2)) : 0;

  async function saveQuote() {
    if (!plan || !selectedPlanId) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id:           leadId ?? null,
        customer_name:     customerName || null,
        customer_email:    customerEmail || null,
        promo_note:        promoNote || null,
        quote_type:        "fiber",
        fiber_plan:        selectedPlanId,
        total_lines:       1,
        autopay_paperless: autopay,
        wireless_bundle:   bundleOn,
        discount_type:     "none",
        premium_lines:     0,
        extra_lines:       0,
        starter_lines:     0,
        port_in_lines:     0,
        new_lines:         0,
        upgrade_lines:     0,
        monthly_total:     rate,
        activation_fee:    0,
        status:            "draft",
        lines: [{
          line_number:    1,
          plan_type:      selectedPlanId,
          rate_plan:      rate,
          plan_promo:     0,
          next_up:        false,
          next_up_amt:    0,
          insurance:      0,
          retailer_promo: 0,
          device:         0,
          device_promo:   0,
          line_total:     rate,
        }],
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
        <h1 className="text-xl font-semibold text-gray-900">AT&T Fiber Quote</h1>
        <p className="text-sm text-gray-500 mt-1">Build a fiber internet quote for your customer.</p>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 border-b border-gray-100 pb-1">
        {[1, 2].map(s => (
          <button key={s}
            onClick={() => { if (s < step || (s === 2 && selectedPlanId)) setStep(s); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              step === s ? "bg-blue-50 text-blue-700" : "text-gray-400 hover:text-gray-600"
            }`}>
            {s === 1 ? "Step 1 · Select Plan" : "Step 2 · Options & Summary"}
          </button>
        ))}
      </div>

      {/* ── STEP 1: Plan selection ── */}
      {step === 1 && (
        <div className="flex flex-col gap-5">

          {/* Customer name + email */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Customer</p>
            <input
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="relative">
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="Customer email (sends them the quote)"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {customerEmail && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-green-100 text-green-700 font-semibold rounded px-1.5 py-0.5">
                  Quote will be emailed
                </span>
              )}
            </div>
          </div>

          {/* Plan groups */}
          {FIBER_PLAN_GROUPS.map(group => (
            <div key={group.label} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">{group.label}</p>
              <div className="flex flex-col gap-2">
                {group.ids.map(planId => {
                  const p       = FIBER_PLANS.find(fp => fp.id === planId)!;
                  const selected = selectedPlanId === planId;
                  return (
                    <button key={planId} onClick={() => setSelectedPlanId(planId)}
                      className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                      }`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${selected ? "text-blue-700" : "text-gray-800"}`}>
                          {p.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.speed}</p>
                        {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className={`text-lg font-bold ${selected ? "text-blue-700" : "text-gray-800"}`}>
                          {fmt(p.autopayPrice)}
                        </p>
                        <p className="text-xs text-gray-400">/mo w/ AutoPay</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            disabled={!selectedPlanId}
            onClick={() => setStep(2)}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
            Next: Options & Summary →
          </button>
        </div>
      )}

      {/* ── STEP 2: Options + Summary ── */}
      {step === 2 && plan && (
        <div className="flex flex-col gap-5">

          {/* Selected plan banner */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-800">{plan.label}</p>
              <p className="text-xs text-blue-500">{plan.speed}</p>
            </div>
            <button onClick={() => setStep(1)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
              Change
            </button>
          </div>

          {/* Discounts */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-4">
            <p className="text-sm font-semibold text-gray-800">Discounts</p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autopay}
                onChange={e => setAutopay(e.target.checked)}
                disabled={isAccess}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <p className={`text-sm font-medium ${isAccess ? "text-gray-400" : "text-gray-800"}`}>
                  AutoPay + Paperless Billing
                </p>
                <p className="text-xs text-gray-400">
                  {isAccess
                    ? "No AutoPay discount for AT&T Access"
                    : `Saves $${plan.basePrice - plan.autopayPrice}/mo`}
                </p>
              </div>
            </label>

            <label className={`flex items-center gap-3 ${isAccess ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={bundleOn}
                onChange={e => setWirelessBundle(e.target.checked)}
                disabled={isAccess}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Wireless Bundle Discount</p>
                <p className="text-xs text-gray-400">
                  20% off — customer must have an eligible AT&T wireless plan
                </p>
              </div>
            </label>

            {isAccess && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                AT&T Access is a fixed-rate low-income program ($30/mo). Discounts do not apply.
                Customer must qualify via SNAP, Medicaid, or a similar program.
              </p>
            )}
          </div>

          {/* Current promotion */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <div>
              <p className="text-sm font-semibold text-gray-800">Current Promotion</p>
              <p className="text-xs text-gray-400 mt-0.5">Shown on the customer&apos;s quote — e.g. &quot;$100 gift card for new subscribers&quot;</p>
            </div>
            <textarea
              rows={2}
              value={promoNote}
              onChange={e => setPromoNote(e.target.value)}
              placeholder="Leave blank if no active promo"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>

          {/* Price breakdown */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 mb-3">Price Breakdown</p>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{plan.label} — base price</span>
              <span className="text-gray-800">{fmt(plan.basePrice)}/mo</span>
            </div>

            {autopayDiscount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">AutoPay & Paperless discount</span>
                <span className="text-green-600">−{fmt(autopayDiscount)}/mo</span>
              </div>
            )}

            {bundleDiscount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Wireless bundle discount (20%)</span>
                <span className="text-green-600">−{fmt(bundleDiscount)}/mo</span>
              </div>
            )}

            <div className="border-t border-gray-100 pt-2 mt-1 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Monthly Total</span>
              <span className="text-xl font-bold text-blue-700">{fmt(rate)}/mo</span>
            </div>

            <p className="text-xs text-gray-400 pt-1">
              Excludes taxes and fees. No activation fee or equipment rental — gateway included.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              ← Edit Plan
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
