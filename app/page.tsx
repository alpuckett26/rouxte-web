import Link from "next/link";
import VideoBackground from "@/app/components/VideoBackground";
import { Counter, GlowCard } from "@/app/components/LandingClient";

export const metadata = {
  title: "Rouxte — Your dealership. In a box.",
  description:
    "Onboarding, training, lead capture, AI coaching, quoting, video meetings, payroll — every tool your fiber or wireless dealership needs, in one app.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white overflow-x-hidden selection:bg-blue-500/40 [text-wrap:balance]">

      {/* ── Ambient mesh + noise ─────────────────────────────────────────── */}
      <AnimatedMesh />
      <NoiseLayer />

      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="relative z-30 max-w-7xl mx-auto flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Rouxte" className="h-10" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
          <a href="#capabilities" className="hover:text-white transition">What's in the box</a>
          <a href="#replaces" className="hover:text-white transition">What it replaces</a>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="text-sm font-medium text-white/80 hover:text-white">
            Sign in
          </Link>
          <Link href="/pricing" className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition">
            Start free trial
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative z-10 min-h-[88vh] flex flex-col items-center justify-center text-center px-6 py-16">
        <VideoBackground />

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md px-3 py-1.5 text-xs font-semibold tracking-wide uppercase mb-6 text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Built for fiber + wireless dealers
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.02] tracking-tight drop-shadow-2xl">
            Your dealership.
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-green-400 bg-clip-text text-transparent">
              In a box.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl mx-auto text-lg sm:text-xl text-white/80 leading-relaxed drop-shadow [text-wrap:pretty]">
            Onboarding, training, lead capture, AI coaching, quoting, video meetings, payroll —
            every tool your team needs to knock, close, and grow. In one app that's actually
            built for your business.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pricing"
              className="group relative rounded-2xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-blue-600/40 hover:bg-blue-500 transition-all hover:scale-[1.02]"
            >
              Start free 30-day trial
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <a
              href="#capabilities"
              className="rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-md px-8 py-4 text-base font-medium text-white/90 hover:bg-white/15 transition"
            >
              See what's inside
            </a>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/50">
            <span>✓ No credit card hassle — 30 days truly free</span>
            <span>✓ Set up in under 10 minutes</span>
            <span>✓ Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* ── Stats row (animated) ─────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-white/[0.06] bg-[#070c18]/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                <Counter to={s.value} suffix={s.suffix ?? ""} />
              </div>
              <div className="mt-1 text-xs font-semibold tracking-wide uppercase text-white/40">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What's in the box ────────────────────────────────────────────── */}
      <section id="capabilities" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-semibold tracking-wide uppercase text-blue-400 mb-3">
            What's in the box
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
            Every tool a dealership runs on.
            <br />
            <span className="text-white/60">Not one tool short.</span>
          </h2>
          <p className="mt-5 text-lg text-white/60 [text-wrap:pretty]">
            Every other "field sales platform" was bolted together from generic CRM parts. We built
            ours from scratch for door-to-door fiber and wireless — and packed in everything you'd
            otherwise stitch together from five different vendors.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, idx) => (
            <GlowCard key={c.title} delay={idx * 60}>
              <div className="text-3xl mb-4">{c.emoji}</div>
              <h3 className="text-xl font-bold text-white">{c.title}</h3>
              <p className="mt-1.5 text-sm text-white/55 leading-relaxed [text-wrap:pretty]">{c.blurb}</p>
              <ul className="mt-4 space-y-1.5">
                {c.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-white/75">
                    <span className="text-blue-400 mt-0.5 shrink-0">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* ── What this replaces ────────────────────────────────────────────── */}
      <section id="replaces" className="relative z-10 bg-gradient-to-br from-blue-950/40 via-[#0a0f1e] to-indigo-950/30 border-y border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="text-xs font-semibold tracking-wide uppercase text-emerald-400 mb-3">
              The Frankenstein tax
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
              Stop paying for five tools to do half a job.
            </h2>
            <p className="mt-5 text-lg text-white/60 [text-wrap:pretty]">
              The average door-to-door dealer cobbles together a CRM, a knocking app, a video
              tool, a scheduler, a docusign-clone, a quoting tool, and a payroll system. Then
              spends Monday morning copying data between them. Rouxte makes that pile go away.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-white/10">
              <div className="p-6 sm:p-8">
                <div className="text-xs font-semibold tracking-wide uppercase text-white/40 mb-4">The usual stack</div>
                <div className="space-y-2.5">
                  {REPLACES.map((r) => (
                    <div key={r.tool} className="flex items-center gap-3">
                      <span className="text-white/30 line-through text-sm">{r.tool}</span>
                      <span className="text-xs text-white/30 ml-auto tabular-nums">{r.price}</span>
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-t border-white/10 flex justify-between">
                    <span className="text-sm text-white/50">Monthly total</span>
                    <span className="text-sm font-bold text-red-300 tabular-nums">$420+/rep/mo</span>
                  </div>
                </div>
              </div>
              <div className="p-6 sm:p-8 bg-gradient-to-br from-blue-500/[0.08] to-emerald-500/[0.04]">
                <div className="text-xs font-semibold tracking-wide uppercase text-blue-300 mb-4">Or just Rouxte</div>
                <div className="flex items-center gap-3 mb-3">
                  <img src="/logo.svg" alt="" className="h-8" />
                </div>
                <p className="text-sm text-white/80 leading-relaxed">
                  All of that. One login. One bill. One audit trail. One support team.
                </p>
                <div className="mt-5 pt-3 border-t border-white/10 flex justify-between">
                  <span className="text-sm text-white/70">Starting at</span>
                  <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tabular-nums">$9.99/rep/mo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Master dealer / rev-share pitch ───────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a0f1e] via-blue-950/50 to-indigo-950/30 p-8 sm:p-14 overflow-hidden relative">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="text-xs font-semibold tracking-wide uppercase text-blue-300 mb-3">For master dealers</div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl">
              The platform your sub-dealers will actually keep using.
            </h2>
            <p className="mt-5 text-lg text-white/70 max-w-2xl [text-wrap:pretty]">
              Rouxte Enterprise is built for master dealers and rev-share partners. White-label
              your own brand, manage every sub-dealer org from one console, and collect
              rev-share on every monthly invoice — for the life of the account.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="mailto:sales@rouxte.com?subject=Master%20Dealer%20Inquiry"
                className="rounded-2xl bg-white text-gray-900 font-semibold px-6 py-3 hover:bg-gray-100 transition"
              >
                Talk to sales →
              </a>
              <Link href="/pricing" className="rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-3 text-white/90 hover:bg-white/10 transition">
                See full pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 text-center px-6 py-24 border-t border-white/[0.06]">
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl mx-auto">
          See it run for your team.
        </h2>
        <p className="mt-4 text-lg text-white/60 max-w-xl mx-auto">
          30 days free. Card required to keep things humming on day 31, but charge nothing during the trial.
        </p>
        <Link
          href="/pricing"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-blue-600/40 hover:bg-blue-500 transition-all hover:scale-[1.02]"
        >
          Start your free trial
          <span>→</span>
        </Link>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#070c18]/60">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="h-7" />
            <span>© {new Date().getFullYear()} Rouxte</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/pricing" className="hover:text-white/70">Pricing</Link>
            <Link href="/privacy" className="hover:text-white/70">Privacy</Link>
            <Link href="/terms" className="hover:text-white/70">Terms</Link>
            <a href="mailto:sales@rouxte.com" className="hover:text-white/70">Sales</a>
            <a href="mailto:support@rouxte.com" className="hover:text-white/70">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Decorative layers                                                       */
/* ════════════════════════════════════════════════════════════════════════ */

function AnimatedMesh() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-blue-600 opacity-[0.18] blur-[120px] animate-[meshA_18s_ease-in-out_infinite_alternate]" />
      <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-indigo-500 opacity-[0.14] blur-[110px] animate-[meshB_22s_ease-in-out_infinite_alternate]" />
      <div className="absolute bottom-0 left-1/3 h-[450px] w-[450px] rounded-full bg-emerald-500 opacity-[0.08] blur-[110px] animate-[meshC_28s_ease-in-out_infinite_alternate]" />
      <style>{`
        @keyframes meshA { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(120px,80px) scale(1.15); } }
        @keyframes meshB { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(-100px,60px) scale(1.1); } }
        @keyframes meshC { 0% { transform: translate(0,0) scale(1); } 100% { transform: translate(80px,-120px) scale(1.2); } }
      `}</style>
    </div>
  );
}

function NoiseLayer() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  Content                                                                 */
/* ════════════════════════════════════════════════════════════════════════ */

const STATS: Array<{ label: string; value: number; suffix?: string }> = [
  { label: "Features in the box",        value: 40, suffix: "+" },
  { label: "Tools it replaces",          value: 7  },
  { label: "Minutes to set up",          value: 10, suffix: "" },
  { label: "Days free, then $9.99/rep",  value: 30 },
];

interface Capability {
  emoji: string;
  title: string;
  blurb: string;
  bullets: string[];
}

const CAPABILITIES: Capability[] = [
  {
    emoji: "🚀",
    title: "Onboard them right",
    blurb: "Every new admin walks through a 6-step setup wizard. Every new rep gets the interactive directions-for-use TOC and AI Coach intro.",
    bullets: [
      "Admin setup wizard (org, branding, team, territory)",
      "Bulk team invites via Resend",
      "Interactive Getting Started TOC",
      "Role-based dashboards day one",
    ],
  },
  {
    emoji: "🗺️",
    title: "Hand them their territory",
    blurb: "A Mapbox-powered map with real FCC fiber coverage overlay, lead pins color-coded by status, and a one-tap drop-a-lead UX.",
    bullets: [
      "Mapbox lead pins, status-colored",
      "FCC AT&T fiber coverage at zoom 11+",
      "Bulk import + zip-code import",
      "Manager Select Area for bulk assign",
    ],
  },
  {
    emoji: "🤖",
    title: "Coach them with Rex",
    blurb: "Rex is your AI sales coach — trained on your scripts, your rebuttals, and your competitive intel. Roleplay homeowners. Voice mode hands-free.",
    bullets: [
      "Claude-powered conversational coach",
      "Homeowner roleplay simulator",
      "Voice mode (TTS + STT)",
      "Org-specific scripts & rebuttals",
    ],
  },
  {
    emoji: "🎯",
    title: "Capture leads on autopilot",
    blurb: "Every rep gets their own SmartPitch funnel — a short scored quiz at /r/their-slug. Hot leads bubble to the top of the day.",
    bullets: [
      "Per-rep public funnel URL",
      "Auto-scored hot/warm/cold",
      "Recommended pitch per submission",
      "QR code for door drops & flyers",
    ],
  },
  {
    emoji: "🧾",
    title: "Quote and close at the door",
    blurb: "Fiber and wireless quote builders that generate clean PDFs, email the customer, and capture their signoff before you leave the porch.",
    bullets: [
      "Fiber quote builder + PDF",
      "Wireless quote builder + email",
      "Customer signoff capture",
      "Auto-attached to lead + sale",
    ],
  },
  {
    emoji: "🎓",
    title: "Train them up",
    blurb: "Branded video + quiz modules with prerequisite chains. Reps graduate at 10 sales and unlock badges, store credit, and Pro features.",
    bullets: [
      "Module-based training paths",
      "Quizzes with auto-grading",
      "Graduation tracking (10+ sales)",
      "Badge & swag store unlock",
    ],
  },
  {
    emoji: "📹",
    title: "Run team meetings in-app",
    blurb: "One-tap instant meetings or scheduled video calls powered by Daily.co. Works on web + mobile WebView — no external app installs.",
    bullets: [
      "Instant + scheduled meetings",
      "Daily.co video, in-app on mobile",
      "Org-wide join with one tap",
      "No external app installs",
    ],
  },
  {
    emoji: "🛡️",
    title: "Approve every sale",
    blurb: "Managers see every submitted sale in a queue. Verify, reject, or send back with one tap. Compensation overrides for team leads built in.",
    bullets: [
      "Sales sign-off queue",
      "Compensation overrides per role",
      "Append-only sales activity log",
      "Compliance event auto-flagging",
    ],
  },
  {
    emoji: "💵",
    title: "Pay them right",
    blurb: "Auto-calculated commissions per pay period. Manager approval before release. Override rules for team leads and sales managers.",
    bullets: [
      "Weekly pay periods auto-generated",
      "Manager review + release",
      "Override rules per role",
      "Pay stubs in-app for reps",
    ],
  },
  {
    emoji: "📲",
    title: "Field-grade mobile",
    blurb: "Native iOS + Android with Field Mode — a one-handed UX that hides everything except map + stats so reps can walk and tap. Offline write queue handles dead zones.",
    bullets: [
      "Native iOS + Android",
      "Field Mode (offline-first)",
      "Speech-to-text everywhere",
      "Push (FCM + APNs) + haptics",
    ],
  },
  {
    emoji: "📊",
    title: "Real-time visibility",
    blurb: "Live notifications, realtime updates via Supabase channels, manager dashboards that update as reps log activity in the field.",
    bullets: [
      "In-app notification bell",
      "Email via Resend + push notifications",
      "Realtime team activity feed",
      "Goal tracking + leaderboard",
    ],
  },
  {
    emoji: "🪪",
    title: "Rep-branded everywhere",
    blurb: "Every rep gets a digital business card, a SmartPitch funnel URL, a QR code, and branded Rouxte merch in the in-app store. Branded by you on Enterprise.",
    bullets: [
      "Digital business cards per rep",
      "Branded merch store via Square",
      "Custom badge designer",
      "White-label on Enterprise",
    ],
  },
];

interface ReplacedTool { tool: string; price: string }
const REPLACES: ReplacedTool[] = [
  { tool: "Generic CRM (Salesforce / Pipedrive)", price: "$80/mo" },
  { tool: "Door-knock tracker (Spotio / SalesRabbit)", price: "$95/mo" },
  { tool: "Calendar + scheduler (Calendly)", price: "$15/mo" },
  { tool: "Video meetings (Zoom)", price: "$22/mo" },
  { tool: "Quote tool (PandaDoc / DocuSign)", price: "$65/mo" },
  { tool: "Payroll / commission tracker", price: "$95/mo" },
  { tool: "Sales coaching app", price: "$50/mo" },
];
