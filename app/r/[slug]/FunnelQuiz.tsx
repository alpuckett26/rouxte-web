"use client";

import { useEffect, useState } from "react";

interface Props {
  slug: string;
  repName: string;
  repPhone?: string | null;
}

const STEPS = [
  {
    id: "service_interest",
    question: "What service are you most interested in?",
    subtitle: "Select the option that best fits your household",
    options: [
      { value: "fiber",    label: "Home Internet / Fiber",      emoji: "🏠" },
      { value: "wireless", label: "Wireless Phone Service",      emoji: "📱" },
      { value: "bundle",   label: "Internet + Wireless Bundle",  emoji: "📦" },
      { value: "business", label: "Business Internet",           emoji: "💼" },
      { value: "unsure",   label: "Not sure yet",                emoji: "🤔" },
    ],
  },
  {
    id: "current_provider",
    question: "Who is your current provider?",
    subtitle: "Select your primary internet or wireless carrier",
    options: [
      { value: "spectrum", label: "Spectrum",                  emoji: "🔵" },
      { value: "xfinity",  label: "Xfinity / Comcast",         emoji: "🟠" },
      { value: "tmobile",  label: "T-Mobile Home Internet",     emoji: "🩷" },
      { value: "verizon",  label: "Verizon",                   emoji: "🔴" },
      { value: "att",      label: "AT&T",                      emoji: "🔵" },
      { value: "other",    label: "Other / Not sure",           emoji: "❓" },
    ],
  },
  {
    id: "pain_point",
    question: "What is your biggest frustration with your current service?",
    subtitle: "Be honest — this helps us find the right fit",
    options: [
      { value: "high_bill",   label: "My bill is too high",          emoji: "💸" },
      { value: "slow",        label: "Internet is too slow",          emoji: "🐌" },
      { value: "drops",       label: "Service drops or cuts out",     emoji: "📡" },
      { value: "phone_deal",  label: "Need a better phone deal",      emoji: "📲" },
      { value: "moving",      label: "Moving soon",                   emoji: "📦" },
      { value: "comparing",   label: "Just comparing options",        emoji: "🔍" },
    ],
  },
  {
    id: "monthly_bill",
    question: "What is your estimated monthly bill right now?",
    subtitle: "Include internet and wireless if bundled together",
    options: [
      { value: "under_75",  label: "Under $75",    emoji: "💚" },
      { value: "75_125",    label: "$75 – $125",   emoji: "💛" },
      { value: "125_200",   label: "$125 – $200",  emoji: "🟠" },
      { value: "over_200",  label: "Over $200",    emoji: "🔴" },
      { value: "unsure",    label: "Not sure",     emoji: "❓" },
    ],
  },
  {
    id: "switch_timeline",
    question: "How soon would you switch if the offer made sense?",
    subtitle: "No pressure — just helps us prioritize",
    options: [
      { value: "today",       label: "Today — I'm ready",         emoji: "⚡" },
      { value: "this_week",   label: "This week",                  emoji: "📅" },
      { value: "this_month",  label: "This month",                 emoji: "🗓️" },
      { value: "researching", label: "Just researching for now",   emoji: "🔍" },
    ],
  },
] as const;

type StepId = typeof STEPS[number]["id"];
type Answers = Record<StepId, string> & {
  address: string; city: string; state_abbr: string; zip: string;
  customer_name: string; phone: string; email: string; sms_consent: boolean;
};

const EMPTY: Answers = {
  service_interest: "", current_provider: "", pain_point: "",
  monthly_bill: "", switch_timeline: "",
  address: "", city: "", state_abbr: "", zip: "",
  customer_name: "", phone: "", email: "", sms_consent: false,
};

export default function FunnelQuiz({ slug, repName, repPhone }: Props) {
  const [step, setStep] = useState<number>(1);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; temperature: string } | null>(null);
  const [contactPickerSupported, setContactPickerSupported] = useState(false);
  const [contactFilled, setContactFilled] = useState(false);

  const totalSteps = 7;

  useEffect(() => {
    setContactPickerSupported(
      typeof navigator !== "undefined" &&
      "contacts" in navigator &&
      "ContactsManager" in window
    );
  }, []);

  async function pickContact() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contacts = await (navigator as any).contacts.select(
        ["name", "tel", "email"],
        { multiple: false }
      );
      if (!contacts?.length) return;
      const c = contacts[0];
      setAnswers(prev => ({
        ...prev,
        customer_name: c.name?.[0]  ?? prev.customer_name,
        phone:         c.tel?.[0]   ?? prev.phone,
        email:         c.email?.[0] ?? prev.email,
      }));
      setContactFilled(true);
    } catch {
      // user cancelled
    }
  }

  function pick(field: StepId, value: string) {
    setAnswers(prev => ({ ...prev, [field]: value }));
    setStep(prev => prev + 1);
  }

  async function submit() {
    if (!answers.customer_name.trim() || !answers.phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/funnel/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, answers }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Something went wrong."); return; }
      setResult({ score: json.score, temperature: json.temperature });
      setStep(8);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const progress = Math.min((step - 1) / totalSteps * 100, 100);

  if (step === 8 && result) {
    return (
      <div className="px-4 pb-10">
        <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">
            {result.temperature === "hot" ? "🔥" : result.temperature === "warm" ? "✅" : "👍"}
          </div>
          {result.temperature === "hot" && (
            <div className="inline-block bg-red-50 text-red-700 border border-red-200 rounded-full px-4 py-1 text-xs font-bold mb-4 uppercase tracking-wide">
              Great news — you qualify for our best offers
            </div>
          )}
          {result.temperature === "warm" && (
            <div className="inline-block bg-green-50 text-green-700 border border-green-200 rounded-full px-4 py-1 text-xs font-bold mb-4 uppercase tracking-wide">
              Offers available in your area
            </div>
          )}
          {result.temperature === "cold" && (
            <div className="inline-block bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-4 py-1 text-xs font-bold mb-4 uppercase tracking-wide">
              We'll check what's available for you
            </div>
          )}
          <h2 className="text-xl font-black text-gray-900 mb-2">You're all set!</h2>
          <p className="text-sm text-gray-500 mb-6">
            {repName} will be in touch shortly to walk you through the best options for your home.
          </p>
          {repPhone && (
            <a href={`tel:${repPhone}`}
              className="block w-full rounded-xl bg-[#1BAEE1] py-3 text-sm font-bold text-white text-center mb-3">
              Call {repName} Now
            </a>
          )}
          <p className="text-xs text-gray-300 mt-4">
            This form is powered by Rouxte · AT&T Authorized Dealer
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10">
      <div className="max-w-sm mx-auto mb-4">
        <div className="h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1BAEE1] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white/40 text-xs text-right mt-1">{Math.min(step, totalSteps)} of {totalSteps}</p>
      </div>

      <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        {step <= 5 && (() => {
          const s = STEPS[step - 1];
          return (
            <div className="p-6">
              <p className="text-xs text-[#1BAEE1] font-bold uppercase tracking-widest mb-2">
                Question {step} of {totalSteps}
              </p>
              <h2 className="text-lg font-black text-gray-900 mb-1">{s.question}</h2>
              <p className="text-xs text-gray-400 mb-5">{s.subtitle}</p>
              <div className="flex flex-col gap-2">
                {s.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => pick(s.id as StepId, opt.value)}
                    className="flex items-center gap-3 w-full rounded-xl border border-gray-200 px-4 py-3.5 text-left text-sm font-medium text-gray-800 hover:border-[#1BAEE1] hover:bg-blue-50 transition-colors active:scale-[0.98]"
                  >
                    <span className="text-xl leading-none">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {step === 6 && (
          <div className="p-6">
            <p className="text-xs text-[#1BAEE1] font-bold uppercase tracking-widest mb-2">
              Question 6 of {totalSteps}
            </p>
            <h2 className="text-lg font-black text-gray-900 mb-1">What's your service address?</h2>
            <p className="text-xs text-gray-400 mb-5">We'll check what's available in your area</p>
            <div className="flex flex-col gap-3">
              <input
                placeholder="Street address"
                value={answers.address}
                onChange={e => setAnswers(p => ({ ...p, address: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="City"
                  value={answers.city}
                  onChange={e => setAnswers(p => ({ ...p, city: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <input
                  placeholder="ZIP code"
                  value={answers.zip}
                  onChange={e => setAnswers(p => ({ ...p, zip: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setStep(5)}
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                  ← Back
                </button>
                <button
                  onClick={() => setStep(7)}
                  className="flex-[2] rounded-xl bg-[#0a0f1e] py-3 text-sm font-bold text-white hover:bg-[#1a2035] transition-colors">
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="p-6">
            <p className="text-xs text-[#1BAEE1] font-bold uppercase tracking-widest mb-2">
              Last step
            </p>
            <h2 className="text-lg font-black text-gray-900 mb-1">How can we reach you?</h2>
            <p className="text-xs text-gray-400 mb-5">Your info is shared only with {repName}</p>
            <div className="flex flex-col gap-3">
              {contactPickerSupported && (
                <button
                  onClick={pickContact}
                  className={`flex items-center justify-center gap-2 w-full rounded-xl border-2 py-3.5 text-sm font-bold transition-colors ${
                    contactFilled
                      ? "border-green-400 bg-green-50 text-green-700"
                      : "border-[#1BAEE1] bg-[#1BAEE1]/5 text-[#1BAEE1] hover:bg-[#1BAEE1]/10"
                  }`}
                >
                  {contactFilled ? "✓ Contact info loaded" : "📇 Use My Contact Info"}
                </button>
              )}
              {contactPickerSupported && !contactFilled && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[10px] text-gray-300 uppercase tracking-wide">or type below</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}
              <input
                autoComplete="name"
                placeholder="Your name *"
                value={answers.customer_name}
                onChange={e => setAnswers(p => ({ ...p, customer_name: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                type="tel"
                autoComplete="tel"
                placeholder="Phone number *"
                value={answers.phone}
                onChange={e => setAnswers(p => ({ ...p, phone: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <input
                type="email"
                autoComplete="email"
                placeholder="Email (optional)"
                value={answers.email}
                onChange={e => setAnswers(p => ({ ...p, email: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <label className="flex items-start gap-3 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={answers.sms_consent}
                  onChange={e => setAnswers(p => ({ ...p, sms_consent: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
                />
                <span className="text-xs text-gray-500">
                  I agree to receive text messages about offers. Message &amp; data rates may apply. Reply STOP to opt out.
                </span>
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setStep(6)}
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                  ← Back
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-[2] rounded-xl bg-[#72C41A] py-3 text-sm font-bold text-white hover:bg-[#5ea614] disabled:opacity-50 transition-colors">
                  {submitting ? "Submitting…" : "See If I Qualify →"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
