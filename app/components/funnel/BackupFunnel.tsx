"use client";

import { useState } from "react";
import { readAttribution, trackLead } from "./AdPixels";

/** Rep funnel (slug → lead assigned to that rep) or org-wide (orgId → unassigned org pool). */
export type BackupTarget = { slug: string } | { orgId: string };

interface Props {
  target: BackupTarget;
  /** Who follows up — the rep's name, or the org name on the org-wide page. */
  contactName: string;
  contactPhone?: string | null;
}

interface Teaser { headline: string; size: string; reasons: string[] }

type ChoiceId = "ownership" | "worry" | "outage" | "fuel" | "solar" | "timeline";

const CHOICES: { id: ChoiceId; question: string; subtitle: string; options: { value: string; label: string; emoji: string }[] }[] = [
  {
    id: "ownership",
    question: "Do you own your home?",
    subtitle: "Backup systems are a permanent install",
    options: [
      { value: "own",  label: "Yes, I own it",   emoji: "🏡" },
      { value: "rent", label: "No, I rent",      emoji: "🔑" },
    ],
  },
  {
    id: "worry",
    question: "What matters most when the power goes out?",
    subtitle: "Pick the one that fits best",
    options: [
      { value: "frequent",  label: "Outages happen too often here",   emoji: "⚡" },
      { value: "storms",    label: "Storm, hurricane or ice season",  emoji: "🌪️" },
      { value: "medical",   label: "Medical equipment at home",       emoji: "🩺" },
      { value: "work_home", label: "I work from home",                emoji: "💻" },
      { value: "food",      label: "Losing food, heat or AC",         emoji: "🧊" },
      { value: "curious",   label: "Just exploring options",          emoji: "🔍" },
    ],
  },
  {
    id: "outage",
    question: "How long do outages usually last?",
    subtitle: "Think about the worst one in the last few years",
    options: [
      { value: "8",   label: "A few hours",       emoji: "🕐" },
      { value: "24",  label: "About a day",       emoji: "🌙" },
      { value: "72",  label: "2–3 days",          emoji: "📆" },
      { value: "168", label: "A week or more",    emoji: "🗓️" },
    ],
  },
  {
    id: "fuel",
    question: "Does your home have natural gas or propane?",
    subtitle: "Helps decide between a generator and a battery",
    options: [
      { value: "natural_gas", label: "Natural gas",     emoji: "🔥" },
      { value: "propane",     label: "Propane tank",    emoji: "🛢️" },
      { value: "none",        label: "Neither",         emoji: "🚫" },
      { value: "unsure",      label: "Not sure",        emoji: "❓" },
    ],
  },
  {
    id: "solar",
    question: "Do you have solar panels?",
    subtitle: "A battery can store your solar for nights and outages",
    options: [
      { value: "yes",      label: "Yes",                 emoji: "☀️" },
      { value: "planning", label: "Thinking about it",   emoji: "🤔" },
      { value: "no",       label: "No",                  emoji: "➖" },
    ],
  },
  {
    id: "timeline",
    question: "When would you want backup power in place?",
    subtitle: "No pressure — just helps us plan",
    options: [
      { value: "asap",        label: "As soon as possible",     emoji: "🚀" },
      { value: "months",      label: "In the next 1–3 months",  emoji: "📅" },
      { value: "year",        label: "Sometime this year",      emoji: "🗓️" },
      { value: "researching", label: "Just researching",        emoji: "🔍" },
    ],
  },
];

const KEEP_OPTIONS = [
  { value: "essentials", label: "Fridge, lights & Wi-Fi",  emoji: "💡" },
  { value: "hvac",       label: "Heat & air conditioning",  emoji: "❄️" },
  { value: "water",      label: "Well or sump pump",        emoji: "💧" },
  { value: "medical",    label: "Medical equipment",        emoji: "🩺" },
  { value: "whole_home", label: "The whole home",           emoji: "🏠" },
];

// Step order: ownership, worry, keep (multi), outage, fuel, solar, timeline, address, contact.
const KEEP_STEP    = 3;
const ADDRESS_STEP = CHOICES.length + 2;
const CONTACT_STEP = CHOICES.length + 3;
const TOTAL        = CONTACT_STEP;

const choiceForStep = (step: number) => CHOICES[step < KEEP_STEP ? step - 1 : step - 2];

const input = "w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-100";

export default function BackupFunnel({ target, contactName, contactPhone }: Props) {
  const [step, setStep] = useState(1);
  const [choices, setChoices] = useState<Partial<Record<ChoiceId, string>>>({});
  const [keep, setKeep] = useState<string[]>([]);
  const [contact, setContact] = useState({
    address: "", city: "", zip: "", customer_name: "", phone: "", email: "", sms_consent: false, company: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teaser, setTeaser] = useState<Teaser | null>(null);

  function pick(id: ChoiceId, value: string) {
    setChoices((prev) => ({ ...prev, [id]: value }));
    setStep((s) => s + 1);
  }

  function toggleKeep(value: string) {
    setKeep((prev) => {
      if (value === "whole_home") return prev.includes(value) ? [] : ["whole_home"];
      const next = prev.filter((v) => v !== "whole_home");
      return next.includes(value) ? next.filter((v) => v !== value) : [...next, value];
    });
  }

  async function submit() {
    if (!contact.customer_name.trim() || !contact.phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/funnel/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug:        "slug" in target ? target.slug : undefined,
          org_id:      "orgId" in target ? target.orgId : undefined,
          answers:     { ...choices, keep, ...contact },
          attribution: readAttribution(),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Something went wrong."); return; }
      if (json.event_id) trackLead(json.event_id);
      setTeaser(json.teaser ?? null);
      setStep(TOTAL + 1);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const back = (
    <button
      onClick={() => setStep((s) => Math.max(1, s - 1))}
      className="flex-1 rounded-xl border border-gray-200 py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
      ← Back
    </button>
  );

  if (step > TOTAL) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="text-5xl mb-4">🔋</div>
        <h2 className="text-xl font-black text-gray-900 mb-2">You&apos;re on the list!</h2>
        {teaser && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 my-5 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Your home looks like a fit for</p>
            <p className="text-lg font-black text-gray-900 mt-1">{teaser.headline}</p>
            <p className="text-sm text-gray-600">{teaser.size}</p>
            <ul className="mt-2 space-y-1">
              {teaser.reasons.map((r) => <li key={r} className="text-xs text-gray-500">• {r}</li>)}
            </ul>
            <p className="text-[11px] text-gray-400 mt-3">
              A ballpark from your answers. Your free in-home estimate confirms the right size and price.
            </p>
          </div>
        )}
        <p className="text-sm text-gray-500 mb-6">
          {contactName} will reach out shortly to schedule your free estimate.
        </p>
        {contactPhone && (
          <a href={`tel:${contactPhone}`}
            className="block w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-white text-center hover:bg-amber-600">
            Call {contactName} Now
          </a>
        )}
      </div>
    );
  }

  const choice = step !== KEEP_STEP && step < ADDRESS_STEP ? choiceForStep(step) : null;

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-4">
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${((step - 1) / TOTAL) * 100}%` }}
          />
        </div>
        <p className="text-white/50 text-xs text-right mt-1">Step {step} of {TOTAL}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden p-6">
        {choice && (
          <>
            <h2 className="text-lg font-black text-gray-900 mb-1">{choice.question}</h2>
            <p className="text-xs text-gray-400 mb-5">{choice.subtitle}</p>
            <div className="flex flex-col gap-2">
              {choice.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => pick(choice.id, opt.value)}
                  className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium text-gray-800 hover:border-amber-400 hover:bg-amber-50 transition-colors active:scale-[0.98] ${
                    choices[choice.id] === opt.value ? "border-amber-400 bg-amber-50" : "border-gray-200"
                  }`}
                >
                  <span className="text-xl leading-none">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            {step > 1 && <div className="flex mt-4">{back}</div>}
          </>
        )}

        {step === KEEP_STEP && (
          <>
            <h2 className="text-lg font-black text-gray-900 mb-1">What do you want to keep running?</h2>
            <p className="text-xs text-gray-400 mb-5">Choose all that apply</p>
            <div className="flex flex-col gap-2">
              {KEEP_OPTIONS.map((opt) => {
                const on = keep.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleKeep(opt.value)}
                    aria-pressed={on}
                    className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3.5 text-left text-sm font-medium text-gray-800 transition-colors ${
                      on ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:border-amber-300"
                    }`}
                  >
                    <span className="text-xl leading-none">{opt.emoji}</span>
                    <span className="flex-1">{opt.label}</span>
                    <span className={`h-5 w-5 rounded-md border-2 flex items-center justify-center text-[11px] font-bold ${
                      on ? "border-amber-500 bg-amber-500 text-white" : "border-gray-300"
                    }`}>{on ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-4">
              {back}
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!keep.length}
                className="flex-[2] rounded-xl bg-[#0a0f1e] py-3 text-sm font-bold text-white hover:bg-[#1a2035] disabled:opacity-40 transition-colors">
                Continue →
              </button>
            </div>
          </>
        )}

        {step === ADDRESS_STEP && (
          <>
            <h2 className="text-lg font-black text-gray-900 mb-1">Where is the home?</h2>
            <p className="text-xs text-gray-400 mb-5">We&apos;ll check local rebates and installer availability</p>
            <div className="flex flex-col gap-3">
              <input autoComplete="street-address" placeholder="Street address" value={contact.address}
                onChange={(e) => setContact((p) => ({ ...p, address: e.target.value }))} className={input} />
              <div className="grid grid-cols-2 gap-2">
                <input autoComplete="address-level2" placeholder="City" value={contact.city}
                  onChange={(e) => setContact((p) => ({ ...p, city: e.target.value }))} className={input} />
                <input autoComplete="postal-code" inputMode="numeric" placeholder="ZIP code" value={contact.zip}
                  onChange={(e) => setContact((p) => ({ ...p, zip: e.target.value }))} className={input} />
              </div>
              <div className="flex gap-2 mt-2">
                {back}
                <button
                  onClick={() => setStep(CONTACT_STEP)}
                  className="flex-[2] rounded-xl bg-[#0a0f1e] py-3 text-sm font-bold text-white hover:bg-[#1a2035] transition-colors">
                  Continue →
                </button>
              </div>
            </div>
          </>
        )}

        {step === CONTACT_STEP && (
          <>
            <p className="text-xs text-amber-600 font-bold uppercase tracking-widest mb-2">Last step</p>
            <h2 className="text-lg font-black text-gray-900 mb-1">Where should we send your results?</h2>
            <p className="text-xs text-gray-400 mb-5">Your info is shared only with {contactName}</p>
            <div className="flex flex-col gap-3">
              <input autoComplete="name" placeholder="Your name *" value={contact.customer_name}
                onChange={(e) => setContact((p) => ({ ...p, customer_name: e.target.value }))} className={input} />
              <input type="tel" autoComplete="tel" placeholder="Phone number *" value={contact.phone}
                onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))} className={input} />
              <input type="email" autoComplete="email" placeholder="Email (optional)" value={contact.email}
                onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))} className={input} />
              {/* Honeypot — hidden from people, filled by bots. */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={contact.company}
                onChange={(e) => setContact((p) => ({ ...p, company: e.target.value }))}
                className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              <label className="flex items-start gap-3 cursor-pointer mt-1">
                <input type="checkbox" checked={contact.sms_consent}
                  onChange={(e) => setContact((p) => ({ ...p, sms_consent: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-amber-500 flex-shrink-0" />
                <span className="text-xs text-gray-500">
                  I agree to receive text messages about my estimate. Message &amp; data rates may apply. Reply STOP to opt out.
                </span>
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 mt-2">
                {back}
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-[2] rounded-xl bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                  {submitting ? "Sending…" : "See My Results →"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
