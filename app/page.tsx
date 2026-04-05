import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white overflow-hidden">

      {/* ── Ambient glow blobs ─────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-blue-600 opacity-[0.12] blur-[120px]" />
        <div className="absolute top-1/2 -right-32 h-[500px] w-[500px] rounded-full bg-indigo-500 opacity-[0.10] blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-blue-400 opacity-[0.07] blur-[100px]" />
      </div>

      {/* ── Top nav ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          {/* Logo — replace /logo.png with your file */}
          <img
            src="/logo.png"
            alt="Rouxte"
            className="h-8"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="text-xl font-bold tracking-tight text-white">Rouxte</span>
        </div>
        <Link
          href="/auth"
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/10 transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-24 flex flex-col items-center text-center lg:pt-24">

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          Built for AT&amp;T fiber door-to-door teams
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          Close more doors.
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-300 bg-clip-text text-transparent">
            Track every win.
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-white/60 leading-relaxed">
          Rouxte puts live coverage maps, lead management, team performance, and payroll in one app — built specifically for fiber sales reps in the field.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link
            href="/auth"
            className="rounded-2xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/auth"
            className="rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-base font-medium text-white/80 backdrop-blur-sm hover:bg-white/10 transition-colors"
          >
            Sign in to your team
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full text-left">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                {f.icon}
              </div>
              <p className="font-semibold text-white text-sm">{f.title}</p>
              <p className="mt-1 text-xs text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-3 gap-8 border-t border-white/8 pt-12 w-full max-w-lg">
          {[
            { label: "Coverage check", value: "Live" },
            { label: "Chargeback tracking", value: "90-day" },
            { label: "Commission tiers", value: "Built-in" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="mt-0.5 text-xs text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/8 py-6 text-center text-xs text-white/30">
        © {new Date().getFullYear()} Rouxte. All rights reserved.
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    title: "Live Coverage Map",
    desc: "Check AT&T fiber availability at any address before you knock.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    title: "Lead Management",
    desc: "Pin leads, track statuses, log sales and notes from the street.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Team & Goals",
    desc: "Managers set targets, track standings, and keep reps accountable.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: "Automated Payroll",
    desc: "Weekly stubs auto-generated with commissions, bonuses, and chargebacks.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];
