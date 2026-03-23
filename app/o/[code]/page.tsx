"use client";

import { useState } from "react";
import { use } from "react";
import ScreenShell from "@/components/ScreenShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface Props {
  params: Promise<{ code: string }>;
}

export default function OptOutPage({ params }: Props) {
  const { code } = use(params);
  const [address, setAddress] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/optout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, qr_code: code }),
      });
      if (!res.ok) throw new Error("Submission failed. Please try again.");
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell>
      <div className="flex flex-col items-center justify-center min-h-[85vh] text-center px-4">
        <img src="/brand/rouxte-logo.png" alt="Rouxte" className="h-9 mx-auto mb-8" />

        {submitted ? (
          <div className="w-full max-w-sm">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Address Registered</h1>
            <p className="text-gray-500">
              Your address has been added to our No Solicitation list. Our reps will not visit this address.
            </p>
            <p className="mt-4 text-xs text-gray-400">
              If you continue to receive visits, contact us through the company listed on your door-hanger.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm text-left">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
              No Solicitation Request
            </h1>
            <p className="text-gray-500 text-center mb-8">
              Enter your address below to opt out of door-to-door visits from our sales team.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Street Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Austin, TX 78701"
                required
              />

              {error && (
                <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" loading={loading} className="w-full">
                Submit Opt-Out
              </Button>
            </form>

            <p className="mt-6 text-xs text-gray-400 text-center">
              This request is processed within 24 hours. Your address will be suppressed from our rep&apos;s field map.
            </p>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}
