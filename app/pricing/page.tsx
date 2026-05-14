import Link from "next/link";
import { TIERS, TRIAL_DAYS, formatPriceLabel, type Tier } from "@/lib/billing/tiers";

export const metadata = {
  title: "Pricing · Rouxte",
  description:
    "Per-rep monthly pricing for the door-to-door sales operating system. 30-day free trial on every plan.",
};

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Do you charge during the free trial?",
    a: "No. We collect a card so service continues uninterrupted on day 31, but we don't charge anything during the free trial. Cancel anytime before day 31 and you're never billed.",
  },
  {
    q: "How does per-rep pricing work?",
    a: "We bill once per month based on the number of active reps in your org during that period. A rep who knocks at least one door or logs any activity counts as active. Reps you've invited but never logged in don't count.",
  },
  {
    q: "Can I mix tiers across teams?",
    a: "Org-wide pricing keeps things simple. If you need different functionality for different sub-teams, talk to us about the Enterprise plan — multi-org and per-team licensing live there.",
  },
  {
    q: "What happens if my card fails on renewal?",
    a: "We retry over a 7-day grace period and email you each attempt. Your team keeps full access during the grace period. If the card still fails after 7 days, the account moves to read-only until billing is updated.",
  },
  {
    q: "Are you SOC 2 / HIPAA / etc?",
    a: "Rouxte is built on Supabase + Vercel infrastructure (SOC 2 Type II). We do not collect PHI. For dealer-specific compliance needs (DNC scrub integrations, state-by-state solicitation rules) — that's the Enterprise tier.",
  },
  {
    q: "I'm a master dealer. How does the rev-share work?",
    a: "Enterprise customers who bring sub-dealers onto Rouxte get a revenue-share on every sub-dealer's monthly invoice for the life of that account. Terms scale with volume. Email sales@rouxte.com for the deck.",
  },
];

export default function PricingPage() {
  // All three tiers in one row, ordered Field → Pro → Enterprise.
  const ordered = [...TIERS].sort((a, b) => {
    const order: Record<string, number> = { field: 0, pro: 1, enterprise: 2 };
    return (order[a.key] ?? 99) - (order[b.key] ?? 99);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/40">
      {/* Top bar */}
      <header className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Rouxte" className="h-7" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Sign in
            </Link>
            <Link href="/auth/signup" className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700">
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold tracking-wide uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-500" />
          Built for door-to-door fiber + wireless
        </div>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 [text-wrap:balance]">
          Built for fiber and wireless crews —
          <br />
          <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-lime-600 bg-clip-text text-transparent">
            without SPOTIO-level pricing.
          </span>
        </h1>
        <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto [text-wrap:pretty]">
          Rouxte gives door-to-door telecom teams lead maps, AI coaching, quote tools, sales
          logging, training, and manager visibility starting at <strong>$9.99 per rep</strong>.
        </p>
        <p className="mt-3 text-sm text-gray-500">
          Start free for {TRIAL_DAYS} days. No charge during trial. Cancel before day {TRIAL_DAYS + 1} and you won't be billed.
        </p>
      </section>

      {/* Tiers — three cards side by side */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {ordered.map((t) => <TierCard key={t.key} tier={t} />)}
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="text-lime-600">✓</span> No annual contract required</span>
          <span className="flex items-center gap-1.5"><span className="text-lime-600">✓</span> Cancel anytime during trial</span>
          <span className="flex items-center gap-1.5"><span className="text-lime-600">✓</span> Per-rep, monthly billing</span>
          <span className="flex items-center gap-1.5"><span className="text-lime-600">✓</span> No setup or onboarding fees</span>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Enterprise typically replies in under 24 hours. Master dealer rev-share terms scale with volume.
        </p>
      </section>

      {/* Founding Dealer Program */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-100 text-lime-800 text-xs font-semibold tracking-wide uppercase mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-500 animate-pulse" />
            Now accepting founding dealers
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Join the founding dealer program</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-2xl mx-auto">
            We're onboarding the first wave of door-to-door dealers. Get in early and you'll
            get more than software — you'll shape the platform alongside our founders.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {FOUNDING_PERKS.map((p) => <FoundingPerk key={p.title} perk={p} />)}
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">
          Founding dealer pricing is locked in for the life of your account, even after public launch.
        </p>
      </section>

      {/* Comparison table */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Compare features at a glance</h2>
        <ComparisonTable />
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently asked</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-gray-200 bg-white open:shadow-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-5">
                <span className="font-semibold text-gray-900">{f.q}</span>
                <svg className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-5 pb-5 text-gray-700">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900">See why dealers are switching to Rouxte.</h2>
        <p className="mt-3 text-gray-600">Start your free trial in under two minutes. Card required, no charge during trial.</p>
        <Link
          href="/auth/signup"
          className="mt-6 inline-flex items-center bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700"
        >
          Start your free trial →
        </Link>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div>© {new Date().getFullYear()} Rouxte. All rights reserved.</div>
          <div className="flex gap-4">
            <a href="mailto:sales@rouxte.com" className="hover:text-gray-700">sales@rouxte.com</a>
            <a href="mailto:support@rouxte.com" className="hover:text-gray-700">support@rouxte.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  const popular    = tier.popular === true;
  const enterprise = tier.key === "enterprise";

  // Color theming — blue is the dominant brand color; Enterprise picks up a
  // splash of brand green (#72C41A ≈ lime-500/600) to set it apart from Pro.
  const ring  = enterprise ? "border-lime-500 shadow-xl ring-2 ring-lime-100" :
                popular    ? "border-blue-600 shadow-xl ring-2 ring-blue-100" :
                             "border-gray-200 shadow-sm";
  const check = enterprise ? "text-lime-600" : "text-blue-600";
  const badge = enterprise ? "bg-lime-500" : "bg-blue-600";
  const cta   = enterprise
    ? "bg-gray-900 text-white hover:bg-black"
    : popular
    ? "bg-blue-600 text-white hover:bg-blue-700"
    : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  const href = enterprise
    ? "mailto:sales@rouxte.com?subject=Enterprise%20%E2%80%94%20Master%20Dealer%20Inquiry"
    : "/auth/signup";

  return (
    <div className={["relative rounded-2xl border bg-white p-6 sm:p-7 flex flex-col", ring].join(" ")}>
      {popular && !enterprise && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full ${badge} text-white text-[10px] font-semibold tracking-wider uppercase shadow whitespace-nowrap`}>
          Most popular
        </div>
      )}
      {enterprise && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full ${badge} text-white text-[10px] font-semibold tracking-wider uppercase shadow whitespace-nowrap`}>
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

      {/* Team-pricing math examples */}
      {tier.monthly_price_cents !== null && (
        <div className="mt-3 text-xs text-gray-500 space-y-0.5 font-medium">
          <div>
            <span className="text-gray-400">Team of 5 →</span>{" "}
            <span className="text-gray-900 font-semibold tabular-nums">
              ${((tier.monthly_price_cents * 5) / 100).toFixed(2)}/mo
            </span>
          </div>
          <div>
            <span className="text-gray-400">Team of 15 →</span>{" "}
            <span className="text-gray-900 font-semibold tabular-nums">
              ${((tier.monthly_price_cents * 15) / 100).toFixed(2)}/mo
            </span>
          </div>
        </div>
      )}
      {enterprise && (
        <div className="mt-3 text-xs text-gray-500 space-y-0.5 font-medium">
          <div>
            <span className="text-gray-400">25+ reps →</span>{" "}
            <span className="text-lime-700 font-semibold">Volume pricing + rev-share</span>
          </div>
          <div>
            <span className="text-gray-400">Master dealer →</span>{" "}
            <span className="text-gray-900 font-semibold">Talk to us</span>
          </div>
        </div>
      )}

      {tier.best_for && (
        <div className={[
          "mt-3 rounded-lg px-3 py-2 text-xs font-medium",
          popular    ? "bg-blue-50 text-blue-800 border border-blue-100" :
          enterprise ? "bg-lime-50 text-lime-800 border border-lime-100" :
                       "bg-gray-50 text-gray-700 border border-gray-100",
        ].join(" ")}>
          🎯 {tier.best_for}
        </div>
      )}

      <ul className="mt-5 space-y-2.5 text-sm text-gray-700 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className={`${check} mt-0.5`}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={["mt-6 inline-flex items-center justify-center font-semibold px-5 py-3 rounded-xl transition", cta].join(" ")}
      >
        {tier.cta}
      </Link>
    </div>
  );
}

function ComparisonTable() {
  const rows: Array<{ label: string; field: boolean | string; pro: boolean | string; ent: boolean | string }> = [
    { label: "Lead capture + map",        field: true, pro: true, ent: true },
    { label: "Mobile + Field Mode",       field: true, pro: true, ent: true },
    { label: "AI Coach (Rex)",            field: "50/day/rep", pro: "Unlimited", ent: "Unlimited" },
    { label: "SmartPitch funnel",         field: true, pro: true, ent: true },
    { label: "Quote builder (fiber + wireless)", field: false, pro: true, ent: true },
    { label: "Manager queue + sign-off",  field: false, pro: true, ent: true },
    { label: "Payroll + commission overrides", field: false, pro: true, ent: true },
    { label: "In-app video meetings",     field: false, pro: true, ent: true },
    { label: "Training modules + quizzes", field: false, pro: true, ent: true },
    { label: "FCC AT&T coverage data",    field: false, pro: true, ent: true },
    { label: "Manager seats included",    field: "1", pro: "Up to 5", ent: "Unlimited" },
    { label: "White-label / custom brand", field: false, pro: false, ent: true },
    { label: "API access",                field: false, pro: false, ent: true },
    { label: "Master dealer rev-share",   field: false, pro: false, ent: true },
    { label: "Dedicated CSM + SLA",       field: false, pro: false, ent: true },
  ];

  function cell(v: boolean | string) {
    if (typeof v === "string") return <span className="text-sm font-semibold text-gray-900">{v}</span>;
    return v
      ? <span className="text-blue-600 text-xl leading-none">✓</span>
      : <span className="text-gray-300 text-xl leading-none">—</span>;
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Feature</th>
              <th className="text-center px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Field</th>
              <th className="text-center px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-blue-700 bg-blue-50">Pro</th>
              <th className="text-center px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className={i % 2 === 0 ? "" : "bg-gray-50/50"}>
                <td className="px-4 sm:px-6 py-3 text-sm text-gray-700">{r.label}</td>
                <td className="text-center px-4 sm:px-6 py-3">{cell(r.field)}</td>
                <td className="text-center px-4 sm:px-6 py-3 bg-blue-50/30">{cell(r.pro)}</td>
                <td className="text-center px-4 sm:px-6 py-3">{cell(r.ent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Founding Dealer Program                                                 */
/* ════════════════════════════════════════════════════════════════════════ */

interface FoundingPerkDef {
  emoji: string;
  title: string;
  blurb: string;
  bullets: string[];
  accent: "gray" | "blue" | "lime";
}

const FOUNDING_PERKS: FoundingPerkDef[] = [
  {
    emoji: "🔒",
    title: "Lifetime pricing lock",
    blurb: "Whatever you pay at signup is your price forever — even after public launch when rates go up.",
    bullets: [
      "$9.99 Field, $19.99 Pro guaranteed for life",
      "No surprise renewals or price hikes",
      "Locks for every rep you ever add",
    ],
    accent: "gray",
  },
  {
    emoji: "🎙️",
    title: "Direct line to product",
    blurb: "Your feedback ships. Founding dealers get a Slack/Signal line straight to the founders and roadmap input.",
    bullets: [
      "Weekly product office hours",
      "Feature requests prioritized over public roadmap",
      "Beta access to every new feature",
    ],
    accent: "blue",
  },
  {
    emoji: "🛟",
    title: "White-glove onboarding",
    blurb: "We migrate your team, configure your org, train your managers. You knock on day one.",
    bullets: [
      "Hands-on data migration from existing tools",
      "Live training for your management layer",
      "First 30 days of priority support included",
    ],
    accent: "lime",
  },
];

function FoundingPerk({ perk }: { perk: FoundingPerkDef }) {
  const accent = {
    gray: { border: "border-gray-200", gradient: "from-gray-50", chip: "bg-gray-100 text-gray-700" },
    blue: { border: "border-blue-200", gradient: "from-blue-50", chip: "bg-blue-100 text-blue-800" },
    lime: { border: "border-lime-200", gradient: "from-lime-50", chip: "bg-lime-100 text-lime-800" },
  }[perk.accent];

  return (
    <div className={`relative rounded-2xl border ${accent.border} bg-gradient-to-br ${accent.gradient} to-white p-6 flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded-full ${accent.chip}`}>
          Founding dealer perk
        </span>
        <div className="text-2xl leading-none">{perk.emoji}</div>
      </div>

      <h3 className="text-lg font-bold text-gray-900">{perk.title}</h3>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed flex-1 [text-wrap:pretty]">{perk.blurb}</p>

      <ul className="mt-4 space-y-1.5 text-xs text-gray-700">
        {perk.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-lime-600 mt-0.5 shrink-0">✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
