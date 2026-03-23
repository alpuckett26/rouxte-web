"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ScreenShell from "@/components/ScreenShell";
import Button from "@/components/ui/Button";

export default function OnboardingConfirmedPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  async function proceed() {
    await fetch("/api/onboarding/complete-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "promo" }),
    });
    router.push("/onboarding/promo");
  }

  return (
    <ScreenShell>
      <div className="flex flex-col items-center justify-center min-h-[85vh]">
        {/* Popup card */}
        <div
          className={`w-full max-w-sm rounded-2xl border border-gray-100 bg-white shadow-xl px-8 py-10 text-center transition-all duration-300 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <img src="/brand/rouxte-logo.png" alt="Rouxte" className="h-7 mx-auto mb-4" />

          <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Verified!</h2>
          <p className="text-sm text-gray-500 mb-8">
            Welcome to Rouxte. Let&apos;s get your account set up so you can start closing deals.
          </p>

          <Button size="lg" className="w-full" onClick={proceed}>
            See What&apos;s Coming
          </Button>
        </div>
      </div>
    </ScreenShell>
  );
}
