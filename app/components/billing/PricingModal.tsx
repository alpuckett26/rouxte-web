"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { TIERS, TRIAL_DAYS, formatPriceLabel, type Tier, type TierKey } from "@/lib/billing/tiers";

type Step = "pick" | "pay" | "done";

const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PROD    = "https://web.squarecdn.com/v1/square.js";

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
}
interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{
    status: "OK" | "Error";
    token?: string;
    errors?: Array<{ message: string }>;
  }>;
  destroy?: () => Promise<void>;
}

interface Props {
  /** Pre-fill the billing form. */
  defaultEmail?: string;
  defaultName?: string;
  /** Fires after trial creation succeeds. */
  onComplete?: () => void;
}

export default function PricingModal({ defaultEmail, defaultName, onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("pick");
  const [tier, setTier] = useState<Tier | null>(null);
  const [billingEmail, setBillingEmail] = useState(defaultEmail ?? "");
  const [billingName, setBillingName] = useState(defaultName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ tier: string; card_brand?: string; card_last4?: string } | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const cardContainerId = "rouxte-square-card";

  const demoMode   = process.env.NEXT_PUBLIC_BILLING_DEMO_MODE === "true";
  const sqEnv      = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  const sqAppId    = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const sqLocation = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  // Load Square Web Payments SDK once we hit the pay step (skipped in demo mode)
  useEffect(() => {
    if (step !== "pay" || demoMode) return;
    if (!sqAppId || !sqLocation) {
      setError(
        "Square is not configured. Set NEXT_PUBLIC_SQUARE_APPLICATION_ID and NEXT_PUBLIC_SQUARE_LOCATION_ID in your env.",
      );
      return;
    }

    const src = sqEnv === "production" ? SQUARE_SDK_PROD : SQUARE_SDK_SANDBOX;
    let cancelled = false;
    let cleanupCard: SquareCard | null = null;

    const init = async () => {
      // Inject the SDK script if not already present
      if (!window.Square) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
          if (existing) { existing.addEventListener("load", () => resolve()); return; }
          const s = document.createElement("script");
          s.src = src; s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Square SDK"));
          document.body.appendChild(s);
        });
      }

      if (cancelled || !window.Square) return;

      try {
        const payments = await window.Square.payments(sqAppId, sqLocation);
        const card = await payments.card();
        await card.attach(`#${cardContainerId}`);
        if (cancelled) return;
        cardRef.current = card;
        cleanupCard = card;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to mount Square card form");
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanupCard?.destroy?.().catch(() => {});
      cardRef.current = null;
    };
  }, [step, sqEnv, sqAppId, sqLocation, demoMode]);

  const pickable = useMemo(() => TIERS.filter((t) => t.key !== "enterprise"), []);

  function chooseTier(t: Tier) {
    if (t.key === "enterprise") {
      window.location.href = "mailto:sales@rouxte.com?subject=Enterprise%20%E2%80%94%20Master%20Dealer%20Inquiry";
      return;
    }
    setTier(t);
    setError(null);
    setStep("pay");
  }

  async function submit() {
    if (!tier) return;
    if (!demoMode && !cardRef.current) return;
    setError(null);
    setSubmitting(true);

    try {
      // 1. Tokenize card (or use demo nonce)
      let sourceToken: string;
      if (demoMode) {
        sourceToken = "demo";
      } else {
        const result = await cardRef.current!.tokenize();
        if (result.status !== "OK" || !result.token) {
          throw new Error(result.errors?.[0]?.message || "Card details look invalid. Double-check and try again.");
        }
        sourceToken = result.token;
      }

      // 2. POST to our route — creates customer + saves card on file + writes row
      const res = await fetch("/api/billing/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_key:      tier.key,
          source_id:     sourceToken,
          billing_email: billingEmail,
          billing_name:  billingName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);

      setSuccess({
        tier: tier.name,
        card_brand: json.data?.card_brand,
        card_last4: json.data?.card_last4,
      });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function finish() {
    onComplete?.();
    router.refresh();
    router.push("/onboarding/admin-setup");
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {step === "pick" && (
            <PickStep
              tiers={pickable}
              enterprise={TIERS.find((t) => t.key === "enterprise")!}
              onPick={chooseTier}
            />
          )}
          {step === "pay" && tier && (
            <PayStep
              tier={tier}
              cardContainerId={cardContainerId}
              billingEmail={billingEmail}
              setBillingEmail={setBillingEmail}
              billingName={billingName}
              setBillingName={setBillingName}
              onBack={() => { setStep("pick"); setError(null); }}
              onSubmit={submit}
              submitting={submitting}
              error={error}
              demoMode={demoMode}
            />
          )}
          {step === "done" && success && (
            <DoneStep tier={success.tier} brand={success.card_brand} last4={success.card_last4} onContinue={finish} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Step 1 — Pick a tier                                                    */
/* ════════════════════════════════════════════════════════════════════════ */
function PickStep({
  tiers, enterprise, onPick,
}: { tiers: Tier[]; enterprise: Tier; onPick: (t: Tier) => void }) {
  return (
    <div className="px-6 sm:px-10 py-10">
      <div className="text-center mb-10">
        <div className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide uppercase mb-3">
          {TRIAL_DAYS} days free · no charge during trial
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Pick the plan that fits your crew</h1>
        <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
          Rouxte is the operating system for door-to-door teams selling fiber and wireless.
          Every plan starts with a {TRIAL_DAYS}-day free trial — we collect a card to keep
          things humming on day 31, but charge nothing until then.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((t) => (
          <TierCard key={t.key} tier={t} onSelect={() => onPick(t)} />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-blue-700 uppercase">{enterprise.name} · Master dealers</div>
          <h3 className="text-xl font-semibold text-gray-900 mt-1">{enterprise.tagline}</h3>
          <p className="text-gray-600 mt-2 max-w-2xl">{enterprise.description}</p>
        </div>
        <Button size="lg" variant="secondary" onClick={() => onPick(enterprise)}>
          {enterprise.cta} →
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-gray-500">
        All prices are USD, billed monthly per active rep. Cancel anytime during the trial — we won't bill the card.
      </p>
    </div>
  );
}

function TierCard({ tier, onSelect }: { tier: Tier; onSelect: () => void }) {
  const popular = tier.popular === true;
  return (
    <div className={[
      "relative rounded-2xl border bg-white p-6 flex flex-col",
      popular ? "border-blue-600 shadow-xl ring-2 ring-blue-100" : "border-gray-200 shadow-sm",
    ].join(" ")}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold tracking-wide uppercase shadow">
          Most popular
        </div>
      )}
      <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{tier.name}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-gray-900">{formatPriceLabel(tier).split("/")[0]}</span>
        <span className="text-sm text-gray-500">/rep/mo</span>
      </div>
      <p className="mt-3 text-sm text-gray-600">{tier.tagline}</p>
      <ul className="mt-5 space-y-2.5 text-sm text-gray-700 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className="text-blue-600 mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        variant={popular ? "primary" : "secondary"}
        size="lg"
        className="mt-6 w-full"
        onClick={onSelect}
      >
        {tier.cta}
      </Button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Step 2 — Card details                                                   */
/* ════════════════════════════════════════════════════════════════════════ */
interface PayStepProps {
  tier: Tier;
  cardContainerId: string;
  billingEmail: string;
  setBillingEmail: (v: string) => void;
  billingName: string;
  setBillingName: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
  demoMode: boolean;
}

function PayStep({
  tier, cardContainerId, billingEmail, setBillingEmail, billingName, setBillingName,
  onBack, onSubmit, submitting, error, demoMode,
}: PayStepProps) {
  return (
    <div className="grid sm:grid-cols-5">
      {/* Summary rail */}
      <div className="sm:col-span-2 bg-gradient-to-br from-blue-50 via-white to-white p-8 sm:p-10 border-b sm:border-b-0 sm:border-r border-gray-100">
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Choose a different plan
        </button>
        <div className="text-xs font-semibold tracking-wide text-blue-700 uppercase">You're starting</div>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">Rouxte {tier.name}</h2>
        <div className="mt-2 text-3xl font-bold text-gray-900">{formatPriceLabel(tier)}</div>
        <div className="mt-1 text-sm text-gray-500">Billed after your free trial ends</div>

        <div className="mt-8 rounded-xl bg-white border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-green-100 text-green-700 w-9 h-9 flex items-center justify-center font-semibold">
              {TRIAL_DAYS}
            </div>
            <div>
              <div className="font-semibold text-gray-900">Free for {TRIAL_DAYS} days</div>
              <div className="text-sm text-gray-500 mt-0.5">
                No charge today. Cancel anytime before day {TRIAL_DAYS + 1} and we won't bill the card.
              </div>
            </div>
          </div>
        </div>

        <ul className="mt-6 space-y-2 text-sm text-gray-600">
          <li>✓ All {tier.name} features unlocked immediately</li>
          <li>✓ Unlimited reps during trial</li>
          <li>✓ Trial countdown visible in your dashboard</li>
        </ul>
      </div>

      {/* Form */}
      <div className="sm:col-span-3 p-8 sm:p-10">
        <h3 className="text-xl font-semibold text-gray-900">Add your card</h3>
        <p className="text-sm text-gray-500 mt-1">
          Securely processed by Square. We won't charge until your free trial ends.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Billing name">
            <input
              type="text"
              required
              value={billingName}
              onChange={(e) => setBillingName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <Field label="Billing email">
            <input
              type="email"
              required
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              placeholder="billing@yourcompany.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>
          <Field label="Card details">
            {demoMode ? (
              <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-amber-200 text-amber-900 w-9 h-9 flex items-center justify-center font-bold">DEMO</div>
                  <div className="flex-1 text-sm">
                    <div className="font-semibold text-amber-900">Demo mode — card entry skipped</div>
                    <div className="text-amber-800/90 mt-1">
                      Square is bypassed for this presentation. Continuing will start a {30}-day trial with a placeholder card on file. Turn off <code className="bg-white/60 px-1 py-0.5 rounded text-xs">NEXT_PUBLIC_BILLING_DEMO_MODE</code> for the real flow.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div id={cardContainerId} className="min-h-[88px] rounded-xl border border-gray-200 p-3" />
            )}
          </Field>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={onSubmit}
          loading={submitting}
          disabled={!billingEmail || !billingName}
        >
          Start my {TRIAL_DAYS}-day free trial
        </Button>

        <p className="mt-3 text-center text-xs text-gray-400">
          By starting your trial you agree to our Terms and Privacy Policy. You can cancel anytime before the trial ends.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold tracking-wide text-gray-600 uppercase mb-1.5">{label}</span>
      {children}
    </label>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Step 3 — Done                                                           */
/* ════════════════════════════════════════════════════════════════════════ */
function DoneStep({
  tier, brand, last4, onContinue,
}: { tier: string; brand?: string; last4?: string; onContinue: () => void }) {
  return (
    <div className="p-10 sm:p-14 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-3xl">✓</div>
      <h2 className="mt-6 text-3xl font-bold text-gray-900">You're in.</h2>
      <p className="mt-3 text-gray-600 max-w-md mx-auto">
        Your {TRIAL_DAYS}-day free trial of Rouxte {tier} just started. We saved
        {brand && last4 ? ` your ${brand} ending in ${last4}` : " your card"} —
        nothing's charged today.
      </p>
      <div className="mt-8 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 max-w-md mx-auto text-left">
        <div className="font-semibold text-gray-900 mb-1">What's next</div>
        We'll walk you through setting up your org, inviting your team, and getting your first leads on the map.
      </div>
      <Button size="lg" className="mt-8" onClick={onContinue}>
        Take the tour →
      </Button>
    </div>
  );
}
