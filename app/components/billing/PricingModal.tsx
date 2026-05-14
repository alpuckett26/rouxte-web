"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { TIERS, TRIAL_DAYS, formatPriceLabel, type Tier, type TierKey } from "@/lib/billing/tiers";
import type { SquarePayments, SquarePaymentMethod } from "@/lib/billing/square-sdk-types";

type Step = "pick" | "pay" | "done";

const SQUARE_SDK_SANDBOX = "https://sandbox.web.squarecdn.com/v1/square.js";
const SQUARE_SDK_PROD    = "https://web.squarecdn.com/v1/square.js";

type PaymentMethodKind = "card" | "applepay" | "googlepay";

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
  const cardRef = useRef<SquarePaymentMethod | null>(null);
  const applePayRef = useRef<SquarePaymentMethod | null>(null);
  const googlePayRef = useRef<SquarePaymentMethod | null>(null);
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const cardContainerId = "rouxte-square-card";
  const applePayContainerId = "rouxte-square-applepay";
  const googlePayContainerId = "rouxte-square-googlepay";

  const demoMode   = process.env.NEXT_PUBLIC_BILLING_DEMO_MODE === "true";
  const sqEnv      = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  const sqAppId    = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const sqLocation = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  // Load Square Web Payments SDK once we hit the pay step (skipped in demo mode)
  useEffect(() => {
    if (step !== "pay" || demoMode || !tier) return;
    if (!sqAppId || !sqLocation) {
      setError(
        "Square is not configured. Set NEXT_PUBLIC_SQUARE_APPLICATION_ID and NEXT_PUBLIC_SQUARE_LOCATION_ID in your env.",
      );
      return;
    }

    const src = sqEnv === "production" ? SQUARE_SDK_PROD : SQUARE_SDK_SANDBOX;
    let cancelled = false;
    const cleanups: SquarePaymentMethod[] = [];

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

      let payments: SquarePayments;
      try {
        payments = await window.Square.payments(sqAppId, sqLocation);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to init Square payments");
        return;
      }

      // Card — always mount this. Apple Pay / Google Pay are progressive
      // enhancement; the card form is the universal fallback.
      try {
        const card = await payments.card();
        await card.attach(`#${cardContainerId}`);
        if (cancelled) return;
        cardRef.current = card;
        cleanups.push(card);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to mount card form");
      }

      // Build a single PaymentRequest used by Apple Pay AND Google Pay.
      // Show the tier's monthly price as the "Pay $X" amount with a label
      // making clear this is a future charge — we save the card today,
      // bill on day 31.
      const priceCents = tier.monthly_price_cents ?? 0;
      const amountUsd  = (priceCents / 100).toFixed(2);
      const paymentRequest = payments.paymentRequest({
        countryCode: "US",
        currencyCode: "USD",
        total: {
          amount: amountUsd,
          label: `Rouxte ${tier.name} (after ${TRIAL_DAYS}-day trial)`,
          pending: true,
        },
      });

      // Apple Pay — silently no-ops on non-Safari / non-iOS browsers
      try {
        const ap = await payments.applePay(paymentRequest);
        await ap.attach(`#${applePayContainerId}`);
        if (cancelled) return;
        applePayRef.current = ap;
        cleanups.push(ap);
        setApplePayReady(true);
      } catch {
        /* Apple Pay not available in this browser / merchant — silent */
      }

      // Google Pay — silently no-ops on iOS / unsupported browsers
      try {
        const gp = await payments.googlePay(paymentRequest);
        await gp.attach(`#${googlePayContainerId}`);
        if (cancelled) return;
        googlePayRef.current = gp;
        cleanups.push(gp);
        setGooglePayReady(true);
      } catch {
        /* Google Pay not available — silent */
      }
    };

    init();

    return () => {
      cancelled = true;
      for (const m of cleanups) m.destroy?.().catch(() => {});
      cardRef.current = null;
      applePayRef.current = null;
      googlePayRef.current = null;
      setApplePayReady(false);
      setGooglePayReady(false);
    };
  }, [step, sqEnv, sqAppId, sqLocation, demoMode, tier]);

  const ordered = useMemo(() => {
    const order: Record<string, number> = { field: 0, pro: 1, enterprise: 2 };
    return [...TIERS].sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99));
  }, []);

  function chooseTier(t: Tier) {
    if (t.key === "enterprise") {
      window.location.href = "mailto:sales@rouxte.com?subject=Enterprise%20%E2%80%94%20Master%20Dealer%20Inquiry";
      return;
    }
    setTier(t);
    setError(null);
    setStep("pay");
  }

  async function submit(method: PaymentMethodKind = "card") {
    if (!tier) return;
    setError(null);
    setSubmitting(true);

    try {
      let sourceToken: string;
      if (demoMode) {
        sourceToken = "demo";
      } else {
        const ref =
          method === "applepay"  ? applePayRef.current  :
          method === "googlepay" ? googlePayRef.current :
                                   cardRef.current;
        if (!ref) throw new Error(`${method} is not available yet — try card`);
        const result = await ref.tokenize();
        if (result.status !== "OK" || !result.token) {
          throw new Error(result.errors?.[0]?.message || "Payment details look invalid. Double-check and try again.");
        }
        sourceToken = result.token;
      }

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
            <PickStep tiers={ordered} onPick={chooseTier} />
          )}
          {step === "pay" && tier && (
            <PayStep
              tier={tier}
              cardContainerId={cardContainerId}
              applePayContainerId={applePayContainerId}
              googlePayContainerId={googlePayContainerId}
              applePayReady={applePayReady}
              googlePayReady={googlePayReady}
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
  tiers, onPick,
}: { tiers: Tier[]; onPick: (t: Tier) => void }) {
  return (
    <div className="px-6 sm:px-10 py-10">
      <div className="text-center mb-10">
        <img src="/logo.svg" alt="Rouxte" className="h-8 mx-auto mb-5" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide uppercase mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />
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

      <p className="mt-6 text-center text-xs text-gray-500">
        All prices are USD, billed monthly per active rep. Cancel anytime during the trial — we won't bill the card.
      </p>
    </div>
  );
}

function TierCard({ tier, onSelect }: { tier: Tier; onSelect: () => void }) {
  const popular    = tier.popular === true;
  const enterprise = tier.key === "enterprise";

  // Blue stays the dominant brand color; Enterprise picks up brand green
  // (#72C41A ≈ Tailwind lime) to distinguish it from Pro.
  const ring  = enterprise ? "border-lime-500 shadow-xl ring-2 ring-lime-100" :
                popular    ? "border-blue-600 shadow-xl ring-2 ring-blue-100" :
                             "border-gray-200 shadow-sm";
  const check = enterprise ? "text-lime-600" : "text-blue-600";
  const badge = enterprise ? "bg-lime-500" : "bg-blue-600";

  return (
    <div className={["relative rounded-2xl border bg-white p-6 flex flex-col", ring].join(" ")}>
      {popular && !enterprise && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full ${badge} text-white text-xs font-semibold tracking-wide uppercase shadow`}>
          Most popular
        </div>
      )}
      {enterprise && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full ${badge} text-white text-xs font-semibold tracking-wide uppercase shadow`}>
          For master dealers
        </div>
      )}

      <div className={`text-sm font-semibold uppercase tracking-wide ${enterprise ? "text-lime-700" : "text-gray-500"}`}>
        {tier.name}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-gray-900">{formatPriceLabel(tier).split("/")[0]}</span>
        {!enterprise && <span className="text-sm text-gray-500">/rep/mo</span>}
      </div>
      <p className="mt-3 text-sm text-gray-600">{tier.tagline}</p>

      <ul className="mt-5 space-y-2.5 text-sm text-gray-700 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className={`${check} mt-0.5`}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={popular || enterprise ? "primary" : "secondary"}
        size="lg"
        className={[
          "mt-6 w-full",
          enterprise ? "!bg-gray-900 hover:!bg-black" : "",
        ].join(" ")}
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
  applePayContainerId: string;
  googlePayContainerId: string;
  applePayReady: boolean;
  googlePayReady: boolean;
  billingEmail: string;
  setBillingEmail: (v: string) => void;
  billingName: string;
  setBillingName: (v: string) => void;
  onBack: () => void;
  onSubmit: (method?: PaymentMethodKind) => void;
  submitting: boolean;
  error: string | null;
  demoMode: boolean;
}

function PayStep({
  tier, cardContainerId, applePayContainerId, googlePayContainerId,
  applePayReady, googlePayReady,
  billingEmail, setBillingEmail, billingName, setBillingName,
  onBack, onSubmit, submitting, error, demoMode,
}: PayStepProps) {
  const showWallets = demoMode || applePayReady || googlePayReady;

  return (
    <div className="grid sm:grid-cols-5">
      {/* ─────────────────────────── Summary rail ─────────────────────────── */}
      <div className="sm:col-span-2 bg-gradient-to-br from-blue-50 via-white to-white p-8 sm:p-10 border-b sm:border-b-0 sm:border-r border-gray-100">
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-6">
          ← Choose a different plan
        </button>

        <img src="/logo.svg" alt="Rouxte" className="h-7 mb-5" />

        <div className="text-xs font-semibold tracking-wide text-blue-700 uppercase">You're starting</div>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">Rouxte {tier.name}</h2>
        <div className="mt-2 text-3xl font-bold text-gray-900">{formatPriceLabel(tier)}</div>
        <div className="mt-1 text-sm text-gray-500">Billed after your free trial ends</div>

        <div className="mt-8 rounded-xl bg-white border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-lime-100 text-lime-700 w-9 h-9 flex items-center justify-center font-semibold">
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

      {/* ─────────────────────────── Payment form ─────────────────────────── */}
      <div className="sm:col-span-3 p-8 sm:p-10">
        <h3 className="text-xl font-semibold text-gray-900">Save your payment method</h3>
        <p className="text-sm text-gray-500 mt-1">
          We'll save it now and charge nothing until day {TRIAL_DAYS + 1}.
        </p>

        {/* Wallet buttons — Apple Pay / Google Pay */}
        {showWallets && (
          <div className="mt-6 space-y-2.5">
            {/* Demo mode shows both buttons as styled placeholders.
                Real mode: Square SDK mounts the official buttons inside
                the container divs and only mounts methods the browser
                actually supports. */}
            {demoMode ? (
              <>
                <DemoWalletButton kind="applepay" onClick={() => onSubmit("applepay")} disabled={submitting} />
                <DemoWalletButton kind="googlepay" onClick={() => onSubmit("googlepay")} disabled={submitting} />
              </>
            ) : (
              <>
                {applePayReady && (
                  <div
                    id={applePayContainerId}
                    onClick={() => onSubmit("applepay")}
                    className="min-h-[44px] [&_*]:!rounded-xl cursor-pointer"
                  />
                )}
                {googlePayReady && (
                  <div
                    id={googlePayContainerId}
                    onClick={() => onSubmit("googlepay")}
                    className="min-h-[44px] [&_*]:!rounded-xl cursor-pointer"
                  />
                )}
                {/* Containers still mount when SDK hasn't initialized — hidden via state */}
                {!applePayReady && <div id={applePayContainerId} className="hidden" />}
                {!googlePayReady && <div id={googlePayContainerId} className="hidden" />}
              </>
            )}

            <div className="flex items-center gap-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <span className="flex-1 h-px bg-gray-200" />
              or pay with card
              <span className="flex-1 h-px bg-gray-200" />
            </div>
          </div>
        )}

        {/* Card form + billing details */}
        <div className="space-y-4 mt-2">
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
                      Square is bypassed for this presentation. Continuing will start a {TRIAL_DAYS}-day trial with a placeholder card on file.
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
          onClick={() => onSubmit("card")}
          loading={submitting}
          disabled={!billingEmail || !billingName}
        >
          Start my {TRIAL_DAYS}-day free trial
        </Button>

        {/* Trust footer */}
        <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Secured by Square · PCI-compliant tokenized payments</span>
          </div>
          <div className="flex items-center gap-3 opacity-70">
            <CardBrandLogo brand="visa" />
            <CardBrandLogo brand="mastercard" />
            <CardBrandLogo brand="amex" />
            <CardBrandLogo brand="discover" />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          By starting your trial you agree to our Terms and Privacy Policy. You can cancel anytime before the trial ends.
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Demo-mode wallet buttons — visually identical to the real ones          */
/* ──────────────────────────────────────────────────────────────────────── */

function DemoWalletButton({
  kind, onClick, disabled,
}: { kind: "applepay" | "googlepay"; onClick: () => void; disabled?: boolean }) {
  if (kind === "applepay") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full h-11 rounded-xl bg-black text-white flex items-center justify-center gap-1 font-semibold text-sm hover:bg-gray-900 transition disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.05 12.04c-.03-3.16 2.58-4.68 2.7-4.75-1.47-2.15-3.76-2.45-4.58-2.48-1.95-.2-3.8 1.15-4.79 1.15-1 0-2.52-1.12-4.14-1.09C4.16 4.9 2.21 6.13 1.13 8.05c-2.21 3.83-.57 9.49 1.59 12.6 1.06 1.52 2.32 3.22 3.97 3.16 1.6-.07 2.2-1.02 4.13-1.02s2.48 1.02 4.17.99c1.72-.03 2.81-1.55 3.86-3.07 1.21-1.76 1.71-3.47 1.74-3.56-.04-.02-3.34-1.28-3.54-5.11M14.4 3.5c.87-1.05 1.46-2.51 1.3-3.95-1.25.05-2.77.83-3.67 1.87-.81.93-1.51 2.43-1.32 3.85 1.4.11 2.81-.71 3.69-1.77"/>
        </svg>
        Pay
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-11 rounded-xl bg-white text-gray-900 border border-gray-300 flex items-center justify-center gap-2 font-semibold text-sm hover:bg-gray-50 transition disabled:opacity-50"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC04" d="M5.84 14.09A6.96 6.96 0 015.48 12c0-.72.13-1.43.36-2.09V7.07H2.18A10.99 10.99 0 001 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Pay
    </button>
  );
}

function CardBrandLogo({ brand }: { brand: "visa" | "mastercard" | "amex" | "discover" }) {
  // Compact SVG-text representations — no third-party logos to wrangle.
  const labels: Record<string, string> = { visa: "VISA", mastercard: "MC", amex: "AMEX", discover: "DISC" };
  return (
    <div className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-[9px] font-bold tracking-wider text-gray-500 leading-none flex items-center h-5">
      {labels[brand]}
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
      <img src="/logo.svg" alt="Rouxte" className="h-7 mx-auto mb-6" />
      <div className="mx-auto w-16 h-16 rounded-full bg-lime-100 text-lime-700 flex items-center justify-center text-3xl">✓</div>
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
