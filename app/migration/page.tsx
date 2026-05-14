import Link from "next/link";

export const metadata = {
  title: "Migration · Rouxte",
  description:
    "White-glove migration from SPOTIO, SalesRabbit, or any other door-to-door tool. We do the lift so your team doesn't lose a day knocking.",
};

const PLATFORMS: Array<{ name: string; note: string }> = [
  { name: "SPOTIO",             note: "Lead pins, custom fields, activity history" },
  { name: "SalesRabbit",        note: "Lead lists, dispositions, rep assignments" },
  { name: "SmartReach / Tonic", note: "Pitch scripts, rebuttal libraries, training content" },
  { name: "Sale My Stay",       note: "Customer records, sale records, payouts" },
  { name: "Salesforce",         note: "Custom-mapped — we'll review your schema together" },
  { name: "Pipedrive / HubSpot", note: "Contacts, deals, notes, custom fields" },
  { name: "Generic CSV / XLSX", note: "Any export — we'll map columns to Rouxte fields" },
  { name: "Spreadsheets in Drive", note: "Including the inevitable five-sheet rep tracker" },
];

const STEPS: Array<{ n: string; title: string; blurb: string; duration: string }> = [
  {
    n: "1",
    title: "Discovery call",
    blurb:
      "30 minutes with our migration team. We talk through what tools you're on now, what data you want preserved, and what your team's first day on Rouxte needs to look like.",
    duration: "Day 1",
  },
  {
    n: "2",
    title: "Data review + mapping",
    blurb:
      "You send us your exports (or grant read-only API access where possible). We map every field to Rouxte's schema, surface anything ambiguous, and confirm the plan with you.",
    duration: "Days 2-3",
  },
  {
    n: "3",
    title: "Staging import + you sign off",
    blurb:
      "We load your data into a staging org you can log into. You spot-check leads, rep rosters, and sales history. If anything's wrong, we fix it before flipping the switch.",
    duration: "Days 3-4",
  },
  {
    n: "4",
    title: "Cutover + handoff",
    blurb:
      "Production import, manager training session, and a runbook for your team. Reps log in and everything's where they expect it.",
    duration: "Day 5",
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What does it cost?",
    a: "Founding dealers and Enterprise customers get migration included. On Field or Pro, we charge a flat $499 for crews under 10 reps and a per-rep rate for larger imports. We'll quote you on the discovery call.",
  },
  {
    q: "What if the data on the old platform is a mess?",
    a: "Honestly, it usually is — fragmented sheets, missing addresses, fields used for things they weren't designed for. Part of the migration is helping you clean as we go. We'll flag what's worth cleaning vs. leaving behind.",
  },
  {
    q: "Do reps lose their history?",
    a: "No. We bring over each rep's lead pins, sales history, commission record, and notes. Performance graphs in Rouxte will show data starting on your cutover day — but the underlying records are preserved for back-reference.",
  },
  {
    q: "How long is my team offline?",
    a: "Zero. Your old platform stays live during the entire migration. Reps don't log into Rouxte until cutover day, by which point everything's been verified.",
  },
  {
    q: "What about ongoing data after we switch?",
    a: "Once you're on Rouxte, you're on Rouxte. We don't dual-write back to the old tool. The migration is a one-way move designed to be permanent.",
  },
];

export default function MigrationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/40">
      {/* Top bar */}
      <header className="border-b border-gray-100 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Rouxte" className="h-7" />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
            <a
              href="mailto:migrations@rouxte.com?subject=Migration%20concierge%20call"
              className="font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"
            >
              Book a call
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-100 text-lime-800 text-xs font-semibold tracking-wide uppercase mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-lime-500 animate-pulse" />
          White-glove migration · included on Enterprise
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 [text-wrap:balance]">
          Switching from another platform?
          <br />
          <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-lime-600 bg-clip-text text-transparent">
            We'll handle the lift.
          </span>
        </h1>
        <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto [text-wrap:pretty]">
          Your team knocks for a living. They shouldn't be losing a week wrestling with CSV
          exports. Our migration team brings your leads, rep roster, and sales history into
          Rouxte while your team keeps selling.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a
            href="mailto:migrations@rouxte.com?subject=Migration%20concierge%20call"
            className="rounded-2xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/30 transition"
          >
            Book your discovery call →
          </a>
          <Link
            href="/pricing"
            className="rounded-2xl border border-gray-200 bg-white px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            See pricing first
          </Link>
        </div>
      </section>

      {/* Platforms we move from */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">We migrate from anything you're on now</h2>
          <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
            If you've got an export, an API, or even a tangle of spreadsheets — we've seen it.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="font-semibold text-gray-900">{p.name}</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">{p.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* The process */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <div className="text-xs font-semibold tracking-wide uppercase text-blue-700 mb-2">The process</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">5 days, zero downtime</h2>
            <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
              Your existing tool stays live the whole time. Reps don't log into Rouxte until
              we're ready and you've signed off on the staging data.
            </p>
          </div>
          <div className="space-y-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-gray-200 p-5 sm:p-6 flex gap-4 sm:gap-6 items-start">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                  {s.n}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="font-semibold text-gray-900">{s.title}</div>
                    <div className="text-xs font-semibold text-lime-700 bg-lime-50 px-2 py-1 rounded-full">{s.duration}</div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1.5 leading-relaxed [text-wrap:pretty]">{s.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you keep */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-blue-50 via-white to-lime-50/40 p-8 sm:p-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">What comes over</h2>
            <p className="mt-2 text-gray-600">Everything that matters. Nothing that doesn't.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 max-w-3xl mx-auto">
            {[
              "Lead pins with addresses, GPS, status, dispositions",
              "Rep roster with names, contact, role, team assignments",
              "Customer records with phone, email, account history",
              "Historical sales with commission, dates, products sold",
              "Custom field mappings (we'll work through these together)",
              "Notes, photos, and attachments tied to leads",
              "Active appointments and scheduled follow-ups",
              "Manager hierarchies and team structures",
            ].map((item) => (
              <div key={item} className="flex gap-2 text-sm text-gray-700">
                <span className="text-lime-600 mt-0.5 shrink-0">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Migration FAQ</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-gray-200 bg-white open:shadow-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-5">
                <span className="font-semibold text-gray-900">{f.q}</span>
                <svg className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-5 pb-5 text-gray-700 leading-relaxed [text-wrap:pretty]">{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 [text-wrap:balance]">
          Ready to stop fighting your tools?
        </h2>
        <p className="mt-3 text-gray-600 max-w-md mx-auto">
          One discovery call. We tell you exactly what your switch looks like, what comes
          over, and what it'll cost. No commitment to schedule it.
        </p>
        <a
          href="mailto:migrations@rouxte.com?subject=Migration%20concierge%20call"
          className="mt-6 inline-flex items-center bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700"
        >
          Book your discovery call →
        </a>
        <p className="mt-3 text-xs text-gray-400">
          Typical reply &lt; 24 hours · migrations@rouxte.com
        </p>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div>© {new Date().getFullYear()} Rouxte. All rights reserved.</div>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
            <a href="mailto:sales@rouxte.com" className="hover:text-gray-700">Sales</a>
            <a href="mailto:support@rouxte.com" className="hover:text-gray-700">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
