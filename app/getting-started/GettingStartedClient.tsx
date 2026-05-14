"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";

/* ════════════════════════════════════════════════════════════════════════ */
/*  Content                                                                 */
/* ════════════════════════════════════════════════════════════════════════ */

interface Section {
  id: string;
  title: string;
  icon: string;
  blurb: string;            // 1-2 sentence "what is this"
  steps: string[];          // numbered how-to
  tips?: string[];          // pro tips
  link: { href: string; label: string };
  audience?: "rep" | "manager" | "admin" | "all";
}

const SECTIONS: Section[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "📊",
    blurb:
      "Your real-time scoreboard. Knocks, conversations, leads dropped, sales submitted, payouts — all in one glance.",
    steps: [
      "Open Home from the top nav. It loads with today's stats.",
      "Switch the time-range tabs to compare today, week, month.",
      "Tap any number to drill into the underlying logs.",
    ],
    link: { href: "/dashboard", label: "Open Home" },
    audience: "all",
  },
  {
    id: "map",
    title: "Map + Lead Pinpoints",
    icon: "🗺️",
    blurb:
      "A Mapbox-powered view of every lead in your area, color-coded by status. The single most important screen for door-to-door reps.",
    steps: [
      "Open Map from the top nav.",
      "Long-press anywhere to drop a new lead at that exact location.",
      "Pinch-to-zoom past street level (zoom 11+) to see AT&T fiber coverage overlay.",
      "Tap any pin to open the lead card, set status, log a knock.",
    ],
    tips: [
      "Managers + team leads: drag-rectangle on the map to bulk-assign leads to a rep via the Select Area tool.",
      "Field Mode (mobile only) hides everything except map + stats so you can walk and tap one-handed.",
    ],
    link: { href: "/map", label: "Open Map" },
    audience: "all",
  },
  {
    id: "leads",
    title: "Leads List",
    icon: "📋",
    blurb:
      "Spreadsheet-style view of your leads with filters, sorting, and bulk actions. Use this when you need lists, the map when you need locations.",
    steps: [
      "Open Leads → filter by status, owner, or recency.",
      "Tap a lead to open its card and timeline.",
      "Use Import Leads to drop a spreadsheet of addresses (CSV/XLSX) or pull from a zip code.",
    ],
    link: { href: "/leads", label: "Open Leads" },
    audience: "rep",
  },
  {
    id: "smartpitch",
    title: "SmartPitch Funnel",
    icon: "🎯",
    blurb:
      "Your personal lead-capture link. Send it via text or QR, prospect fills out a short quiz, you get a hot/warm/cold-scored lead with a recommended pitch.",
    steps: [
      "Open SmartPitch from the More menu. Customize your slug and questions once.",
      "Share /r/your-slug — every submission shows up here scored automatically.",
      "Filter by hot leads to triage the day's calls first.",
    ],
    link: { href: "/smartpitch", label: "Open SmartPitch" },
    audience: "rep",
  },
  {
    id: "coach",
    title: "AI Coach (Rex)",
    icon: "🤖",
    blurb:
      "An always-on sales coach trained on your scripts, rebuttals, and competitive intel. Ask it for help mid-pitch or role-play a tough door.",
    steps: [
      "Open Coach. Type your question or hit Roleplay to simulate a homeowner.",
      "Voice mode reads responses back so you can practice hands-free.",
      "Admins can load org-specific scripts and competitor data via Coach Q&A in settings.",
    ],
    tips: [
      "Reps get 50 prompts/day on the Field tier; unlimited on Pro and Enterprise.",
      "Managers and admins are never rate-limited.",
    ],
    link: { href: "/coach", label: "Open Coach" },
    audience: "all",
  },
  {
    id: "quotes",
    title: "Quote Builder",
    icon: "🧾",
    blurb:
      "Generate clean fiber and wireless quotes at the door. PDF and email built in — customer signs off before you leave.",
    steps: [
      "Open Quotes → New Fiber Quote or New Wireless Quote.",
      "Pick the customer (or attach to a lead) and add line items.",
      "Send → emails the customer a PDF (fiber) or plain-text body (wireless) signed in your name.",
    ],
    link: { href: "/quotes", label: "Open Quotes" },
    audience: "all",
  },
  {
    id: "logger",
    title: "Sales Activity Logger",
    icon: "📝",
    blurb:
      "Every knock, conversation, sale, and incident lands in an append-only timeline. Compliance-friendly and audit-proof.",
    steps: [
      "Log from anywhere — the lead card, the map's quick-log button, or the mobile Field Mode timeline.",
      "If you need to correct a log, it stays in the timeline and is amended (not deleted).",
      "Compliance events (no-solicit signs, do-not-knock requests) are auto-flagged for managers.",
    ],
    link: { href: "/dashboard", label: "See your activity" },
    audience: "all",
  },
  {
    id: "manager",
    title: "Manager Queue",
    icon: "🛡️",
    blurb:
      "Approve or reject submitted sales before they hit payroll. Verify with one tap, leave a note, and the rep gets notified instantly.",
    steps: [
      "Open Manager → Queue.",
      "Each pending sale shows the rep, customer, address, and submitted notes.",
      "Approve, reject, or send back — every action is logged.",
    ],
    link: { href: "/manager/queue", label: "Open Manager Queue" },
    audience: "manager",
  },
  {
    id: "payroll",
    title: "Payroll + Commissions",
    icon: "💵",
    blurb:
      "Auto-calculated commissions for reps; full payroll runs for admins. Includes overrides for team leads and managers.",
    steps: [
      "Reps: open Pay to see this period's earnings and your sign-off-pending and approved sales.",
      "Admins: open Manager → Payroll to run a period, see payouts per rep, and adjust overrides.",
      "Override commission rules let you bump a team lead's cut on their team's sales.",
    ],
    link: { href: "/payroll", label: "Open Payroll" },
    audience: "all",
  },
  {
    id: "meetings",
    title: "In-App Video Meetings",
    icon: "📹",
    blurb:
      "Spin up a video call instantly. Daily.co-powered, runs inside the app on both web and mobile — no third-party tools.",
    steps: [
      "Open Meet → Start now for a one-tap call, or schedule one ahead of time.",
      "Share the join link — anyone in your org can join with one tap, no app install needed for visitors.",
      "Mobile uses the in-app WebView; web opens the meeting in a new tab.",
    ],
    link: { href: "/meetings", label: "Open Meet" },
    audience: "all",
  },
  {
    id: "training",
    title: "Training Modules",
    icon: "🎓",
    blurb:
      "Onboard new reps fast with branded video + quiz modules. Track completion org-wide.",
    steps: [
      "Reps: open Training. Modules unlock as prerequisites are completed.",
      "Admins: upload your own modules and quizzes; require completion for graduation.",
      "Graduated status (10+ sales) unlocks badges and store credit.",
    ],
    link: { href: "/training", label: "Open Training" },
    audience: "all",
  },
  {
    id: "settings",
    title: "Org Settings + Billing",
    icon: "⚙️",
    blurb:
      "Org name, branding, billing, integrations. The control center for admins.",
    steps: [
      "Open Settings (gear icon, top-right).",
      "Update billing, manage your subscription, change your card on file.",
      "Integrations: connect carriers, configure Coach knowledge, set commission rules.",
    ],
    link: { href: "/settings", label: "Open Settings" },
    audience: "admin",
  },
];

/* ════════════════════════════════════════════════════════════════════════ */
/*  Page                                                                    */
/* ════════════════════════════════════════════════════════════════════════ */

export default function GettingStartedClient() {
  const params = useSearchParams();
  const welcomeMode = params?.get("welcome") === "1";

  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set([SECTIONS[0].id]));
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Active section follows scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    SECTIONS.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function scrollTo(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    setOpenIds((prev) => new Set(prev).add(id));
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function expandAll() { setOpenIds(new Set(SECTIONS.map((s) => s.id))); }
  function collapseAll() { setOpenIds(new Set()); }

  const progressPct = useMemo(() => {
    return Math.round((openIds.size / SECTIONS.length) * 100);
  }, [openIds]);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* TOC */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
            <div className="text-xs font-semibold tracking-wide uppercase text-blue-100">Contents</div>
            <div className="mt-1 font-semibold">Directions for use</div>
          </div>

          <nav className="p-2 text-sm">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className={[
                  "w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors",
                  activeId === s.id ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="text-base">{s.icon}</span>
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </nav>

          <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
            <button onClick={expandAll} className="text-xs text-blue-700 hover:text-blue-800 font-medium">Expand all</button>
            <span className="text-xs text-gray-300">·</span>
            <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700">Collapse all</button>
          </div>

          <div className="px-4 py-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Sections explored</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-700 tabular-nums">{progressPct}%</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Body */}
      <div>
        {welcomeMode && (
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 sm:p-8 mb-6">
            <div className="text-xs font-semibold tracking-wide text-blue-700 uppercase">Welcome to Rouxte</div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900">Let's get you up and running.</h1>
            <p className="mt-3 text-gray-600 max-w-2xl">
              Click any section on the left to walk through that feature. We recommend starting with
              <strong> Map + Lead Pinpoints</strong> — it's where reps spend 80% of their day.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => scrollTo("map")}>Show me the Map →</Button>
              <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900 inline-flex items-center px-4 py-2">
                Skip to dashboard
              </Link>
            </div>
          </div>
        )}

        {!welcomeMode && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Directions for use</h1>
            <p className="mt-2 text-gray-600">
              Everything Rouxte can do, organized by feature. Open any section for the what + how + where.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {SECTIONS.map((s, idx) => {
            const open = openIds.has(s.id);
            return (
              <div
                key={s.id}
                id={s.id}
                ref={(el) => { sectionRefs.current[s.id] = el; }}
                className="rounded-2xl border border-gray-200 bg-white shadow-sm scroll-mt-20 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleOpen(s.id)}
                  className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl shrink-0">
                    {s.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
                      Step {idx + 1} of {SECTIONS.length}
                    </div>
                    <div className="mt-0.5 text-lg font-semibold text-gray-900">{s.title}</div>
                    {!open && <div className="mt-1 text-sm text-gray-500 line-clamp-1">{s.blurb}</div>}
                  </div>
                  <svg
                    className={`h-5 w-5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {open && (
                  <div className="px-5 sm:px-6 pb-6 -mt-1 pl-[68px] sm:pl-[88px]">
                    <p className="text-gray-700 leading-relaxed">{s.blurb}</p>

                    <div className="mt-5">
                      <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">How to use it</div>
                      <ol className="space-y-2 text-sm text-gray-700">
                        {s.steps.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {s.tips && s.tips.length > 0 && (
                      <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <div className="text-xs font-semibold tracking-wide text-amber-800 uppercase mb-2">Pro tips</div>
                        <ul className="space-y-1.5 text-sm text-amber-900">
                          {s.tips.map((t, i) => <li key={i} className="flex gap-2"><span>💡</span><span>{t}</span></li>)}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 flex gap-3">
                      <Link href={s.link.href}>
                        <Button size="md">{s.link.label} →</Button>
                      </Link>
                      <button
                        onClick={() => {
                          const next = SECTIONS[idx + 1];
                          if (next) scrollTo(next.id);
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                      >
                        Next section ↓
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 sm:p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Ready to roll?</h2>
          <p className="mt-2 text-gray-600 max-w-md mx-auto">
            You don't have to learn everything at once — pin this page in the More menu and come back as new questions come up.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="mt-5">Go to my dashboard →</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
