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
  is_portin: boolean;
  portin_phone: string;
  portin_carrier: string;
  portin_account: string;
  portin_pin: string;
}

const PLAN_LABELS: Record<PlanType, string> = {
  premium:             "Premium Unlimited",
  extra:               "Extra (50GB)",
  starter:             "Starter",
  firstnet_unlimited:  "FirstNet Unlimited",
  firstnet_extra:      "FirstNet Extra",
  senior_55plus:       "55+ Plan",
};

const DISCOUNT_LABELS: Record<DiscountType, string> = {
  none:         "None",
  appreciation: "Appreciation (25% off)",
  signature:    "Signature ($10/line off)",
};

// Note: AARP Signature Program discontinued 2025.
// First responders / nurses / military use the Appreciation discount below.
const APPRECIATION_TYPES = [
  "Military", "First Responder", "Retired Law Enforcement",
  "Nurse/Healthcare", "Teacher", "Union Member", "Employee", "Other",
];

// Plans that have their own flat rates — discounts do not apply
const FLAT_RATE_PLANS: PlanType[] = ["firstnet_unlimited", "firstnet_extra", "senior_55plus"];

const CARRIER_GUIDE: { carrier: string; steps: string[]; tip?: string }[] = [
  {
    carrier: "T-Mobile / Metro by T-Mobile",
    steps: [
      "Open T-Mobile app → Account → Profile → Customer Service PIN",
      "Or call 611 and ask for your account number + transfer PIN",
      "Account number is on your bill or in app under Account → Profile",
    ],
    tip: "PIN is 4–6 digits set by customer. If forgotten, reset in app.",
  },
  {
    carrier: "Verizon",
    steps: [
      "My Verizon app → Account → Transfer your number → Generate Transfer PIN",
      "Or visit verizon.com/account/profile and generate a Transfer PIN",
      "Or call 1-800-922-0204",
    ],
    tip: "Verizon Transfer PINs are 6 digits and expire after 7 days.",
  },
  {
    carrier: "Cricket Wireless",
    steps: [
      "Cricket app or cricketwireless.com → My Account → Profile → Account PIN",
      "Or call 1-800-274-2538",
    ],
    tip: "Account number is on the bill or in app under My Account.",
  },
  {
    carrier: "Boost Mobile",
    steps: [
      "My Boost app → Settings → Account PIN",
      "Or call 1-833-502-6678",
    ],
  },
  {
    carrier: "Straight Talk / TracFone / Total Wireless",
    steps: [
      "Visit straighttalk.com → My Account → Port Out PIN",
      "Or call 1-877-430-2355",
    ],
    tip: "Account number is the phone number. PIN is set during account creation.",
  },
  {
    carrier: "US Cellular",
    steps: [
      "My Account portal → Security → PIN",
      "Or call 1-888-944-9400",
    ],
  },
  {
    carrier: "Dish / Boost (new)",
    steps: [
      "My Dish app → Account → Transfer PIN",
      "Or call 1-844-483-9264",
    ],
  },
];

function buildLines(
  counts: Record<PlanType, number>,
  totalLines: number,
  portInCount: number,
  autopay: boolean,
  discount: DiscountType,
  existing: QuoteLine[],
): QuoteLine[] {
  const plan: PlanType[] = (Object.keys(counts) as PlanType[]).flatMap(p =>
    Array(counts[p]).fill(p)
  );

  return plan.map((p, i) => {
    const prev = existing[i];
    const rate = getRate(p, totalLines, autopay, discount);
    return {
      line_number:    i + 1,
      plan_type:      p,
      rate_plan:      rate,
      plan_promo:     prev?.plan_promo ?? 0,
      next_up:        prev?.next_up ?? false,
      next_up_amt:    NEXT_UP_FEE,
      insurance:      prev?.insurance ?? 0,
      retailer_promo: prev?.retailer_promo ?? 0,
      device:         prev?.device ?? 0,
      device_promo:   prev?.device_promo ?? 0,
      line_total:     0,
      is_portin:      i < portInCount,
      portin_phone:   prev?.portin_phone ?? "",
      portin_carrier: prev?.portin_carrier ?? "",
      portin_account: prev?.portin_account ?? "",
      portin_pin:     prev?.portin_pin ?? "",
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

const STANDARD_PLANS: { plan: PlanType; label: string }[] = [
  { plan: "premium",  label: "Premium" },
  { plan: "extra",    label: "Extra" },
  { plan: "starter",  label: "Starter" },
];

const SPECIALIZED_PLANS: { plan: PlanType; label: string; badge: string }[] = [
  { plan: "firstnet_unlimited", label: "FirstNet Unlimited", badge: "~$43/line w/ autopay" },
  { plan: "firstnet_extra",     label: "FirstNet Extra",     badge: "~$48/line w/ autopay" },
  { plan: "senior_55plus",      label: "55+ Plan",           badge: "$35/line w/ autopay" },
];

export default function QuoteBuilder({ leadId, initialCustomerName }: Props) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [customerName,  setCustomerName]  = useState(initialCustomerName ?? "");
  const [customerEmail, setCustomerEmail] = useState("");

  // Standard plan counts
  const [premiumCount,  setPremiumCount]  = useState(1);
  const [extraCount,    setExtraCount]    = useState(0);
  const [starterCount,  setStarterCount]  = useState(0);

  // Specialized plan counts
  const [firstnetUnlimitedCount, setFirstnetUnlimitedCount] = useState(0);
  const [firstnetExtraCount,     setFirstnetExtraCount]     = useState(0);
  const [senior55Count,          setSenior55Count]          = useState(0);

  const [autopay,          setAutopay]          = useState(true);
  const [discount,         setDiscount]         = useState<DiscountType>("none");
  const [appreciationType, setAppreciationType] = useState("");
  const [portIn,           setPortIn]           = useState(0);
  const [newLine,          setNewLine]           = useState(0);
  const [upgrade,          setUpgrade]          = useState(0);

  const [lines,            setLines]            = useState<QuoteLine[]>([]);
  const [showCarrierGuide, setShowCarrierGuide] = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState<string | null>(null);

  const counts: Record<PlanType, number> = {
    premium:            premiumCount,
    extra:              extraCount,
    starter:            starterCount,
    firstnet_unlimited: firstnetUnlimitedCount,
    firstnet_extra:     firstnetExtraCount,
    senior_55plus:      senior55Count,
  };

  const totalLines    = Object.values(counts).reduce((a, b) => a + b, 0);
  const hasSpecialized = firstnetUnlimitedCount + firstnetExtraCount + senior55Count > 0;

  // 55+ requires at least 2 lines
  const senior55Warning = senior55Count > 0 && totalLines < 2;

  useEffect(() => {
    if (totalLines === 0) return;
    setLines(prev => buildLines(counts, totalLines, portIn, autopay, discount, prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premiumCount, extraCount, starterCount, firstnetUnlimitedCount, firstnetExtraCount, senior55Count, portIn, autopay, discount]);

  function updateLine(i: number, field: keyof QuoteLine, value: number | boolean | string) {
    setLines(prev => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, [field]: value };
      return { ...updated, line_total: calcLineTotal(updated) };
    }));
  }

  const monthlyTotal  = lines.reduce((s, l) => s + l.line_total, 0);
  const activationFee = (portIn + newLine) * ACTIVATION_FEE;

  function CountStepper({ val, set }: { val: number; set: (n: number) => void }) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => set(Math.max(0, val - 1))}
          className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors">−</button>
        <span className="text-lg font-bold text-gray-900 w-4 text-center">{val}</span>
        <button onClick={() => set(Math.min(10, val + 1))}
          className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 transition-colors">+</button>
      </div>
    );
  }

  async function saveQuote() {
    if (!totalLines || senior55Warning) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id:           leadId ?? null,
        customer_name:     customerName || null,
        customer_email:    customerEmail || null,
        total_lines:       totalLines,
        autopay_paperless: autopay,
        discount_type:     discount,
        appreciation_type: appreciationType || null,
        premium_lines:     premiumCount,
        extra_lines:       extraCount,
        starter_lines:     starterCount,
        port_in_lines:     portIn,
        new_lines:         newLine,
        upgrade_lines:     upgrade,
        monthly_total:     monthlyTotal,
        activation_fee:    activationFee,
        status:            "draft",
        lines: lines.map(l => ({
          line_number:    l.line_number,
          plan_type:      l.plan_type,
          rate_plan:      l.rate_plan,
          plan_promo:     l.plan_promo,
          next_up:        l.next_up,
          next_up_amt:    l.next_up_amt,
          insurance:      l.insurance,
          retailer_promo: l.retailer_promo,
          device:         l.device,
          device_promo:   l.device_promo,
          line_total:     l.line_total,
          portin_phone:   l.portin_phone || null,
          portin_carrier: l.portin_carrier || null,
          portin_account: l.portin_account || null,
          portin_pin:     l.portin_pin || null,
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
            <div className="relative">
              <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
                placeholder="Customer email (sends them the quote)"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
              {customerEmail && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-green-100 text-green-700 font-semibold rounded px-1.5 py-0.5">
                  Quote will be emailed
                </span>
              )}
            </div>
          </div>

          {/* Standard plans */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Standard Plans</p>
            <div className="grid grid-cols-3 gap-3">
              {STANDARD_PLANS.map(({ plan, label }) => {
                const setters: Record<string, (n: number) => void> = {
                  premium: setPremiumCount, extra: setExtraCount, starter: setStarterCount,
                };
                return (
                  <div key={plan} className="flex flex-col items-center gap-2">
                    <p className="text-xs font-semibold text-center text-gray-700">{label}</p>
                    <CountStepper val={counts[plan]} set={setters[plan]} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Specialized plans */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Specialized Plans</p>
              <p className="text-xs text-gray-400 mt-0.5">
                FirstNet is for verified first responders only. 55+ requires minimum 2 lines.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {SPECIALIZED_PLANS.map(({ plan, label, badge }) => {
                const setters: Record<string, (n: number) => void> = {
                  firstnet_unlimited: setFirstnetUnlimitedCount,
                  firstnet_extra:     setFirstnetExtraCount,
                  senior_55plus:      setSenior55Count,
                };
                return (
                  <div key={plan} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{badge}</p>
                    </div>
                    <CountStepper val={counts[plan]} set={setters[plan]} />
                  </div>
                );
              })}
            </div>
            {senior55Warning && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                The 55+ Plan requires a minimum of 2 lines.
              </p>
            )}
          </div>

          {totalLines > 0 && (
            <p className="text-xs text-center text-gray-400">{totalLines} total line{totalLines !== 1 ? "s" : ""}</p>
          )}

          {/* Discounts — only for standard plans */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Discounts</p>
              {hasSpecialized && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Appreciation & Signature discounts apply to standard plan lines only.
                </p>
              )}
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={autopay} onChange={e => setAutopay(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">AutoPay + Paperless Billing</p>
                <p className="text-xs text-gray-400">Applies to all plan types</p>
              </div>
            </label>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 font-medium">Plan discount (standard plans)</p>
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

          {/* Port-In / New / Upgrade */}
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Port-In / New Line / Upgrade</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Port-In",  val: portIn,   set: setPortIn },
                { label: "New Line", val: newLine,  set: setNewLine },
                { label: "Upgrade",  val: upgrade,  set: setUpgrade },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex flex-col items-center gap-2">
                  <p className="text-xs font-semibold text-gray-600">{label}</p>
                  <CountStepper val={val} set={set} />
                </div>
              ))}
            </div>
            {activationFee > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Activation/Upgrade fee: <strong>{fmt(activationFee)}</strong> on first bill
                ({portIn + newLine} line{portIn + newLine !== 1 ? "s" : ""} × $35)
              </p>
            )}
          </div>

          {/* Carrier port-in guide */}
          {portIn > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 space-y-3">
              <button onClick={() => setShowCarrierGuide(v => !v)}
                className="flex items-center justify-between w-full text-left">
                <div>
                  <p className="text-sm font-semibold text-blue-900">Port-In — What You Need</p>
                  <p className="text-xs text-blue-600 mt-0.5">Account number + port-in PIN from current carrier</p>
                </div>
                <svg className={`h-4 w-4 text-blue-400 transition-transform ${showCarrierGuide ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="rounded-xl bg-white border border-blue-100 px-4 py-3 space-y-1 text-xs text-blue-800">
                <p className="font-semibold mb-2">Collect from each porting customer:</p>
                <div className="flex gap-2"><span>📋</span><span><strong>Account number</strong> — on their current bill or carrier app</span></div>
                <div className="flex gap-2"><span>🔐</span><span><strong>Port-in PIN / Transfer PIN</strong> — NOT their account password</span></div>
                <div className="flex gap-2"><span>📱</span><span><strong>Phone number</strong> being ported</span></div>
                <div className="flex gap-2 mt-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                  <span>⚠️</span>
                  <span>PIN is different from their account login password. Most carriers require the customer to generate it first.</span>
                </div>
              </div>
              {showCarrierGuide && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-blue-800">How to get port-in PIN by carrier:</p>
                  {CARRIER_GUIDE.map(c => (
                    <div key={c.carrier} className="rounded-xl bg-white border border-blue-100 px-4 py-3">
                      <p className="text-xs font-bold text-blue-900 mb-2">{c.carrier}</p>
                      <ol className="flex flex-col gap-1 text-xs text-gray-600 list-decimal list-inside">
                        {c.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                      {c.tip && (
                        <p className="text-xs text-amber-700 mt-2 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-100">
                          💡 {c.tip}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button disabled={totalLines === 0 || senior55Warning} onClick={() => setStep(2)}
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
            {discount !== "none" && !hasSpecialized ? `· ${DISCOUNT_LABELS[discount]}` : ""}
          </p>

          {lines.map((line, i) => {
            const isFlat = FLAT_RATE_PLANS.includes(line.plan_type);
            return (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-blue-700">Line {line.line_number}</p>
                    <p className="text-xs text-gray-500">{PLAN_LABELS[line.plan_type]}</p>
                    {isFlat && (
                      <span className="text-[10px] bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 font-semibold">
                        Flat rate plan
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{fmt(line.line_total)}</p>
                    <p className="text-xs text-gray-400">per month</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="flex items-center justify-between col-span-2 border-b border-gray-50 pb-2">
                    <span className="text-xs text-gray-500">1. Rate Plan</span>
                    <span className="text-sm font-semibold text-gray-800">{fmt(line.rate_plan)}</span>
                  </div>
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

                {line.is_portin && (
                  <div className="mt-3 pt-3 border-t border-blue-100 space-y-2">
                    <p className="text-xs font-semibold text-blue-700">Port-In Details</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-gray-400 mb-0.5 block">Phone # being ported</label>
                        <input type="tel" placeholder="(555) 555-5555"
                          value={line.portin_phone}
                          onChange={e => updateLine(i, "portin_phone", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 mb-0.5 block">Current carrier</label>
                        <select value={line.portin_carrier}
                          onChange={e => updateLine(i, "portin_carrier", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-200">
                          <option value="">Select…</option>
                          {CARRIER_GUIDE.map(c => <option key={c.carrier} value={c.carrier}>{c.carrier}</option>)}
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 mb-0.5 block">Account number</label>
                        <input placeholder="From bill or carrier app"
                          value={line.portin_account}
                          onChange={e => updateLine(i, "portin_account", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 mb-0.5 block">Port-in PIN</label>
                        <input placeholder="Transfer PIN / port PIN"
                          value={line.portin_pin}
                          onChange={e => updateLine(i, "portin_pin", e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={() => setStep(3)}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors">
            Review Summary →
          </button>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-gray-800 mb-3">Total For All Lines</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              {lines.map(l => (
                <div key={l.line_number} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Line {l.line_number} · {PLAN_LABELS[l.plan_type]}
                  </span>
                  <span className="text-sm font-medium text-gray-800">{fmt(l.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3 mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Monthly Total</span>
              <span className="text-xl font-bold text-blue-700">{fmt(monthlyTotal)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">Set Expectations</p>
            <ul className="space-y-2 text-xs text-amber-800">
              <li className="flex gap-2"><span>📋</span>First bill includes a <strong>full month + partial month</strong> depending on activation date.</li>
              <li className="flex gap-2"><span>⏱️</span>Promotions apply within <strong>2–3 billing cycles</strong> after all required steps are completed.</li>
              <li className="flex gap-2"><span>✅</span>Plan promotions require registration at <strong>att.com/signature</strong> once phones are received and activated.</li>
              <li className="flex gap-2"><span>📱</span>Premium Trade-In: devices must be received within <strong>30 days of activation</strong>.</li>
              {activationFee > 0 && (
                <li className="flex gap-2"><span>💳</span>Activation/Upgrade fee of <strong>{fmt(activationFee)}</strong> will be on the upcoming bill.</li>
              )}
            </ul>
          </div>

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
