"use client";

import { useRouter } from "next/navigation";
import ScreenShell from "@/components/ScreenShell";
import Button from "@/components/ui/Button";

const CAPABILITIES: Array<{ emoji: string; title: string; blurb: string }> = [
  { emoji: "🗺️", title: "FCC fiber overlay map",   blurb: "Real coverage at every address — never knock blind." },
  { emoji: "🎯", title: "SmartPitch funnels",       blurb: "Per-rep scored lead capture link with QR." },
  { emoji: "🤖", title: "Rex, your AI coach",       blurb: "Voice roleplay, rebuttals, scripts — never sleeps." },
  { emoji: "🎓", title: "Training + quizzes",       blurb: "Module-based learning paths with graduation." },
  { emoji: "🧾", title: "Fiber + wireless quotes",  blurb: "PDF + email + customer signoff in one tap." },
  { emoji: "💵", title: "Auto-paid commissions",    blurb: "Weekly periods, manager approval, overrides built in." },
  { emoji: "🛡️", title: "Compliance & sign-off",   blurb: "Append-only logger, DNK lists, manager queue." },
  { emoji: "📹", title: "In-app video meetings",    blurb: "Daily.co-powered, instant or scheduled, no extra tools." },
  { emoji: "📲", title: "Field Mode + offline",     blurb: "One-handed mobile UX. Knock through dead zones." },
];

const NEXT_STEPS: Array<{ n: string; label: string; sub: string }> = [
  { n: "1", label: "Tell us about you",  sub: "Quick profile — name, role, contact." },
  { n: "2", label: "Pick a plan",         sub: "30 days free. Card on file, no charge today." },
  { n: "3", label: "Set up your org",     sub: "Branding, team invites, territory zips." },
  { n: "4", label: "Take the tour",       sub: "Walk-through of every feature, with deep links." },
];

export default function PromoPage() {
  const router = useRouter();

  async function proceed() {
    await fetch("/api/onboarding/complete-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "profile" }),
    });
    router.push("/onboarding/profile");
  }

  return (
    <ScreenShell>
      <div className="py-8 sm:py-12">

        {/* Hero */}
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <img src="/logo.svg" alt="Rouxte" className="h-9 mx-auto mb-6" />
          <div className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold tracking-wide uppercase mb-4">
            Welcome aboard
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight [text-wrap:balance]">
            Your dealership.
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
              In a box.
            </span>
          </h1>
          <p className="mt-5 text-lg text-gray-600 [text-wrap:pretty]">
            Onboarding, training, lead capture, AI coaching, quoting, video meetings, payroll —
            every tool you need to run a door-to-door fiber or wireless team. Take a quick look
            at what's inside.
          </p>
        </div>

        {/* Capability grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-12 max-w-4xl mx-auto">
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">{c.emoji}</div>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 text-sm leading-snug">{c.title}</div>
                  <div className="text-xs text-gray-500 mt-1 leading-relaxed">{c.blurb}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* What happens next */}
        <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 sm:p-8 mb-10">
          <div className="text-xs font-semibold tracking-wide uppercase text-blue-700 mb-4">
            Here's what's next
          </div>
          <ol className="grid sm:grid-cols-2 gap-4">
            {NEXT_STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <div className="shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">
                  {s.n}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{s.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.sub}</div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs text-gray-400 text-center">
            Whole thing takes about 10 minutes. Your team can already start knocking on the
            mobile app while you finish setup on web.
          </p>
        </div>

        {/* CTA */}
        <div className="max-w-md mx-auto">
          <Button size="lg" className="w-full" onClick={proceed}>
            Let's go →
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
}
