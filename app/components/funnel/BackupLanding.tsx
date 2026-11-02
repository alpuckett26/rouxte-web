import AdPixels from "./AdPixels";
import BackupFunnel, { type BackupTarget } from "./BackupFunnel";

// Ad-style landing page for home backup power (batteries + standby generators).
// Rendered by the rep funnel (/r/[slug]/backup) and the org-wide page (/power/[orgId]).

const BENEFITS = [
  { emoji: "⚡", title: "Switches on by itself", body: "When the grid drops, your home switches over in seconds — no extension cords, no pull-starts." },
  { emoji: "🧊", title: "Food, heat and AC stay on", body: "Keep the fridge cold, the house comfortable and the sump pump running through the storm." },
  { emoji: "🩺", title: "Peace of mind for medical needs", body: "CPAP, oxygen and refrigerated medicine keep working when it matters most." },
  { emoji: "💻", title: "Stay connected", body: "Wi-Fi, phones and the home office stay up, so work and school don't stop." },
];

const OPTIONS = [
  {
    name: "Home battery",
    example: "e.g. Tesla Powerwall",
    points: ["Silent, no fuel, no fumes", "Pairs with solar to recharge daily", "Best for shorter outages and essentials"],
  },
  {
    name: "Standby generator",
    example: "e.g. Briggs & Stratton",
    points: ["Runs on natural gas or propane", "Powers big loads like central AC", "Best for multi-day outages"],
  },
  {
    name: "Battery + generator",
    example: "The best of both",
    points: ["Battery handles short blips quietly", "Generator backs it up for long ones", "Most resilient setup"],
  },
];

const FAQ = [
  {
    q: "How much does it cost?",
    a: "It depends on what you want to keep running and for how long. Your free estimate gives you an exact price, financing options and any rebates you qualify for.",
  },
  {
    q: "Are there rebates or incentives?",
    a: "Many states and utilities pay homeowners for a home battery, and some offer extra help for seniors, veterans and medical needs. We check what applies at your address.",
  },
  {
    q: "Battery or generator — which is right for me?",
    a: "Answer the quick questions below and we'll show you a ballpark fit for your home. A site visit confirms the final size.",
  },
  {
    q: "Is there any obligation?",
    a: "No. The estimate is free and there's no pressure to buy.",
  },
];

interface Props {
  target: BackupTarget;
  /** Small line under the logo, e.g. "Jane Doe · Acme Energy". */
  byline: string;
  contactName: string;
  contactPhone: string | null;
  orgName: string;
}

export const BACKUP_META = {
  title:       "Free Home Backup Power Estimate",
  description: "Battery or standby generator? See what fits your home in 60 seconds and get a free estimate.",
};

export default function BackupLanding({ target, byline, contactName, contactPhone, orgName }: Props) {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      <AdPixels />
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.18),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-4 pt-6 pb-12 text-center">
          <div className="flex flex-col items-center gap-1 mb-10">
            <div className="text-xl font-black tracking-tight">
              <span className="text-[#1BAEE1]">ROU</span>
              <span className="text-[#72C41A]">X</span>
              <span className="text-[#1BAEE1]">TE</span>
            </div>
            {byline && <p className="text-white/40 text-xs">{byline}</p>}
          </div>

          <p className="inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300 mb-5">
            Free home backup power estimate
          </p>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight">
            The next outage<br className="hidden sm:block" /> doesn&apos;t have to stop your home.
          </h1>
          <p className="text-white/60 text-base sm:text-lg mt-4 max-w-xl mx-auto">
            Home batteries and standby generators that turn on automatically when the power goes out.
            See which fits your home in under a minute.
          </p>
          <a href="#estimate"
            className="inline-block mt-8 rounded-xl bg-amber-500 px-8 py-4 text-base font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-colors">
            Check My Home →
          </a>
          <p className="text-white/30 text-xs mt-3">Free · No obligation · 60 seconds</p>
        </div>
      </header>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <section className="bg-white text-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-black text-center mb-8">Power that&apos;s ready before you are</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <div className="text-2xl mb-2">{b.emoji}</div>
                <p className="font-bold">{b.title}</p>
                <p className="text-sm text-gray-500 mt-1">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Options ──────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 text-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-black text-center mb-2">Battery, generator, or both?</h2>
          <p className="text-sm text-gray-500 text-center mb-8">We help you pick what actually fits your home and budget.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {OPTIONS.map((o) => (
              <div key={o.name} className="rounded-2xl bg-white border border-gray-200 p-5">
                <p className="font-bold">{o.name}</p>
                <p className="text-xs text-gray-400 mb-3">{o.example}</p>
                <ul className="space-y-1.5">
                  {o.points.map((p) => (
                    <li key={p} className="text-sm text-gray-600 flex gap-2"><span className="text-amber-500">✓</span>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funnel ───────────────────────────────────────────────────────── */}
      <section id="estimate" className="scroll-mt-4">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-black text-center mb-2">See what fits your home</h2>
          <p className="text-white/50 text-sm text-center mb-8">A few taps — then {contactName} sets up your free estimate.</p>
          <BackupFunnel target={target} contactName={contactName} contactPhone={contactPhone} />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="bg-white text-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-black text-center mb-8">How it works</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              ["Tell us about your home", "Answer a few quick questions above."],
              ["Get a free estimate", "We size the system and check rebates and financing."],
              ["Licensed install", "A licensed installer handles permits, install and inspection."],
            ].map(([t, b], i) => (
              <li key={t} className="rounded-2xl border border-gray-100 p-5">
                <p className="h-8 w-8 rounded-full bg-amber-500 text-white font-black flex items-center justify-center mb-3">{i + 1}</p>
                <p className="font-bold">{t}</p>
                <p className="text-sm text-gray-500 mt-1">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 text-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-black text-center mb-6">Questions</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-white border border-gray-200 px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold flex justify-between gap-3">
                  {f.q}
                  <span className="text-gray-400 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-gray-500 mt-2">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="#estimate"
              className="inline-block rounded-xl bg-amber-500 px-8 py-3.5 text-sm font-bold text-white hover:bg-amber-600 transition-colors">
              Get My Free Estimate →
            </a>
            {contactPhone && (
              <p className="text-sm text-gray-500 mt-3">
                Or call {contactName}: <a href={`tel:${contactPhone}`} className="font-semibold text-gray-900">{contactPhone}</a>
              </p>
            )}
          </div>
        </div>
      </section>

      <footer className="px-4 py-8 text-center text-white/30 text-[11px] leading-relaxed max-w-2xl mx-auto">
        <p>Powered by Rouxte{orgName ? ` · ${orgName}` : ""}. Estimates are free; system size and price are confirmed at a site visit.</p>
        <p className="mt-1">
          Tesla and Powerwall are trademarks of Tesla, Inc. Briggs &amp; Stratton is a trademark of its owner.
          Product names are used for identification only and do not imply endorsement.
        </p>
      </footer>
    </div>
  );
}

