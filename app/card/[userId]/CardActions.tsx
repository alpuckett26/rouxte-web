"use client";

import { useState } from "react";

interface Props {
  userId: string;
  name: string;
  phone: string | null;
  email: string;
  vcfUrl: string;
  cardUrl: string;
}

export default function CardActions({ userId, name, phone, email, vcfUrl, cardUrl }: Props) {
  const [showExchange, setShowExchange] = useState(false);
  const [exName, setExName] = useState("");
  const [exPhone, setExPhone] = useState("");
  const [exEmail, setExEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: `${name}'s Contact`, url: cardUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function submitExchange(e: React.FormEvent) {
    e.preventDefault();
    if (!exName.trim() || !exPhone.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/card/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repUserId: userId, name: exName, phone: exPhone, email: exEmail }),
    });
    setSubmitting(false);
    if (res.ok) setDone(true);
  }

  return (
    <div className="w-full">
      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/20 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z" />
            </svg>
            Call
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/20 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email
          </a>
        )}
        <button
          onClick={share}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/20 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* Save contact CTA */}
      <a
        href={vcfUrl}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1BAEE1] py-3.5 text-sm font-bold text-white hover:bg-[#159ec8] transition-colors mb-4"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Save Contact
      </a>

      {/* Exchange info */}
      {!done ? (
        !showExchange ? (
          <button
            onClick={() => setShowExchange(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 py-3.5 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Share Your Info
          </button>
        ) : (
          <form onSubmit={submitExchange} className="flex flex-col gap-3 rounded-2xl border border-white/20 p-4">
            <p className="text-sm font-semibold text-white">Share your contact info</p>
            <input
              required
              placeholder="Your name *"
              value={exName}
              onChange={(e) => setExName(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#1BAEE1]"
            />
            <input
              required
              type="tel"
              placeholder="Phone number *"
              value={exPhone}
              onChange={(e) => setExPhone(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#1BAEE1]"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={exEmail}
              onChange={(e) => setExEmail(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#1BAEE1]"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowExchange(false)}
                className="flex-1 rounded-xl border border-white/20 py-2.5 text-sm text-white/60 hover:bg-white/10 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 rounded-xl bg-[#72C41A] py-2.5 text-sm font-bold text-white hover:bg-[#62b015] disabled:opacity-50 transition-colors">
                {submitting ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#72C41A]/40 bg-[#72C41A]/10 py-3.5 text-sm font-semibold text-[#72C41A]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Info shared!
        </div>
      )}
    </div>
  );
}
