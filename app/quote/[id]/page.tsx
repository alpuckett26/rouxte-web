import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { FIBER_PLANS } from "@/lib/quoting/fiber-pricing";

interface Params { params: Promise<{ id: string }> }

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

const WIRELESS_PLAN_LABELS: Record<string, string> = {
  premium:            "Premium Unlimited",
  extra:              "Extra (50GB)",
  starter:            "Starter",
  firstnet_unlimited: "FirstNet Unlimited",
  firstnet_extra:     "FirstNet Extra",
  senior_55plus:      "55+ Plan",
};

function getFiberPlanMeta(planId: string): { label: string; speed: string } {
  const plan = FIBER_PLANS.find(p => p.id === planId);
  return { label: plan?.label ?? planId, speed: plan?.speed ?? "" };
}

function Row({ label, value, credit }: { label: string; value: string; credit?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={credit ? "text-green-600 font-medium" : "text-gray-700"}>{value}</span>
    </div>
  );
}

export default async function QuotePage({ params }: Params) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: quote } = await admin
    .from("quotes")
    .select("*, quote_lines(*), orgs(name)")
    .eq("id", id)
    .single();

  if (!quote) notFound();

  const orgName = (quote.orgs as { name: string } | null)?.name ?? "Your Sales Rep";
  const isFiber = quote.quote_type === "fiber";

  // ── FIBER QUOTE ──
  if (isFiber) {
    const { label: planLabel, speed: planSpeed } = getFiberPlanMeta(quote.fiber_plan ?? "");
    const bundleOn = quote.wireless_bundle === true;

    return (
      <div className="min-h-screen bg-[#f8fafc] py-10 px-4">
        <div className="max-w-lg mx-auto flex flex-col gap-6">

          {/* Header */}
          <div className="bg-[#0a0f1e] rounded-2xl px-6 py-5 flex items-center justify-between">
            <div>
              <div className="text-xl font-black tracking-tight mb-1">
                <span className="text-[#1BAEE1]">ROU</span>
                <span className="text-[#72C41A]">X</span>
                <span className="text-[#1BAEE1]">TE</span>
              </div>
              <p className="text-white/50 text-xs">{orgName}</p>
            </div>
            <div className="text-right">
              <p className="text-white/50 text-xs uppercase tracking-wide">AT&T Fiber Quote</p>
              {quote.customer_name && (
                <p className="text-white text-sm font-semibold mt-0.5">{quote.customer_name}</p>
              )}
            </div>
          </div>

          {/* Monthly total */}
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 text-center shadow-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Estimated Monthly Total</p>
            <p className="text-4xl font-black text-blue-700">{fmt(quote.monthly_total)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {quote.autopay_paperless ? "AutoPay/Paperless applied" : "No AutoPay discount"}
              {bundleOn ? " · Wireless bundle discount applied" : ""}
            </p>
          </div>

          {/* Promo note */}
          {quote.promo_note && (
            <div className="bg-green-50 rounded-2xl border border-green-200 px-6 py-4 shadow-sm">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">Current Promotion</p>
              <p className="text-sm font-medium text-green-800">{quote.promo_note}</p>
            </div>
          )}

          {/* Plan details */}
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-4">Plan Details</p>
            <div className="flex flex-col gap-3 text-xs">
              <Row label="Internet Plan"            value={planLabel} />
              {planSpeed && <Row label="Speed"      value={planSpeed} />}
              <Row label="AutoPay & Paperless"      value={quote.autopay_paperless ? "Yes (−$5/mo)" : "No"} />
              <Row label="Wireless Bundle Discount" value={bundleOn ? "Yes (−20%)" : "No"} />
              <Row label="Activation Fee"           value="$0.00" />
              <Row label="Equipment Fee"            value="$0.00 (gateway included)" />
              <div className="border-t border-gray-100 pt-2 mt-1 flex items-center justify-between">
                <span className="font-bold text-gray-900 text-sm">Monthly Total</span>
                <span className="font-bold text-blue-700 text-sm">{fmt(quote.monthly_total)}</span>
              </div>
            </div>
          </div>

          {/* What to expect */}
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-3">What to Expect</p>
            <ul className="flex flex-col gap-2.5 text-xs text-gray-600">
              <li className="flex items-start gap-2.5">
                <span className="text-base leading-none shrink-0">📋</span>
                <span>Your first bill will include a <strong>full month + a partial month</strong> based on your install date.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-base leading-none shrink-0">🛠️</span>
                <span>AT&T will schedule a <strong>professional installation</strong> — no DIY required.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-base leading-none shrink-0">📦</span>
                <span>Your <strong>Wi-Fi gateway is included</strong> at no additional cost.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-base leading-none shrink-0">💳</span>
                <span><strong>No activation fee</strong> and no annual contract required.</span>
              </li>
              {bundleOn && (
                <li className="flex items-start gap-2.5">
                  <span className="text-base leading-none shrink-0">📱</span>
                  <span>Your <strong>wireless bundle discount</strong> will appear within 1–2 billing cycles after both services are active.</span>
                </li>
              )}
            </ul>
          </div>

          <p className="text-center text-xs text-gray-300">
            Pricing, plans, and promotions subject to change. Quote generated via Rouxte.
          </p>
        </div>
      </div>
    );
  }

  // ── WIRELESS QUOTE ──
  const lines = (quote.quote_lines ?? []).sort(
    (a: { line_number: number }, b: { line_number: number }) => a.line_number - b.line_number
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4">
      <div className="max-w-lg mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="bg-[#0a0f1e] rounded-2xl px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-xl font-black tracking-tight mb-1">
              <span className="text-[#1BAEE1]">ROU</span>
              <span className="text-[#72C41A]">X</span>
              <span className="text-[#1BAEE1]">TE</span>
            </div>
            <p className="text-white/50 text-xs">{orgName}</p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-xs uppercase tracking-wide">AT&T Wireless Quote</p>
            {quote.customer_name && (
              <p className="text-white text-sm font-semibold mt-0.5">{quote.customer_name}</p>
            )}
          </div>
        </div>

        {/* Monthly total */}
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 text-center shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Estimated Monthly Total</p>
          <p className="text-4xl font-black text-blue-700">{fmt(quote.monthly_total)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {quote.total_lines} line{quote.total_lines !== 1 ? "s" : ""} ·{" "}
            {quote.autopay_paperless ? "AutoPay/Paperless applied" : "No AutoPay discount"}
            {quote.discount_type !== "none" ? ` · ${quote.discount_type} discount` : ""}
          </p>
        </div>

        {/* Per-line breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-4">Line Breakdown</p>
          <div className="flex flex-col gap-4">
            {lines.map((line: {
              line_number: number; plan_type: string; rate_plan: number; plan_promo: number;
              next_up: boolean; next_up_amt: number; insurance: number; retailer_promo: number;
              device: number; device_promo: number; line_total: number;
            }) => (
              <div key={line.line_number} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-blue-700">Line {line.line_number}</p>
                    <p className="text-xs text-gray-400">
                      {WIRELESS_PLAN_LABELS[line.plan_type] ?? line.plan_type}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{fmt(line.line_total)}/mo</p>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <Row label="Rate Plan"      value={fmt(line.rate_plan)} />
                  {line.plan_promo > 0     && <Row label="Plan Promo"     value={`−${fmt(line.plan_promo)}`}     credit />}
                  {line.next_up            && <Row label="Next Up"         value={`+${fmt(line.next_up_amt)}`} />}
                  {line.insurance > 0      && <Row label="Insurance"       value={fmt(line.insurance)} />}
                  {line.retailer_promo > 0 && <Row label="Retailer Promo"  value={`−${fmt(line.retailer_promo)}`} credit />}
                  {line.device > 0         && <Row label="Device"          value={fmt(line.device)} />}
                  {line.device_promo > 0   && <Row label="Device Promo"    value={`−${fmt(line.device_promo)}`}    credit />}
                </div>
              </div>
            ))}
          </div>

          {/* Total row */}
          <div className="border-t border-gray-100 mt-4 pt-3 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Monthly Total</span>
            <span className="text-lg font-bold text-blue-700">{fmt(quote.monthly_total)}</span>
          </div>
        </div>

        {/* Expectations */}
        <div className="bg-white rounded-2xl border border-gray-100 px-6 py-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-3">What to Expect</p>
          <ul className="flex flex-col gap-2.5 text-xs text-gray-600">
            <li className="flex items-start gap-2.5">
              <span className="text-base leading-none shrink-0">📋</span>
              <span>Your first bill will include a <strong>full month + a partial month</strong> based on your activation date.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-base leading-none shrink-0">⏱️</span>
              <span>Promotions begin applying within <strong>2–3 billing cycles</strong> after all required steps are complete.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-base leading-none shrink-0">✅</span>
              <span>Plan promotions require registration at <strong>att.com/signature</strong> once phones arrive.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-base leading-none shrink-0">📱</span>
              <span>Trade-in devices must be returned within <strong>30 days of activation</strong>.</span>
            </li>
            {quote.activation_fee > 0 && (
              <li className="flex items-start gap-2.5">
                <span className="text-base leading-none shrink-0">💳</span>
                <span>An activation fee of <strong>{fmt(quote.activation_fee)}</strong> will appear on your first bill.</span>
              </li>
            )}
          </ul>
        </div>

        <p className="text-center text-xs text-gray-300">
          Pricing, plans, and promotions subject to change. Quote generated via Rouxte.
        </p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("quotes").select("customer_name, quote_type").eq("id", id).single();
  const type = data?.quote_type === "fiber" ? "AT&T Fiber" : "AT&T Wireless";
  return {
    title: data?.customer_name
      ? `${type} Quote for ${data.customer_name} | Rouxte`
      : `${type} Quote | Rouxte`,
  };
}
