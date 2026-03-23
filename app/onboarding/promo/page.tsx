"use client";

import { useRouter } from "next/navigation";
import ScreenShell from "@/components/ScreenShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const features = [
  {
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    title: "FCC Broadband Map Overlay",
    desc: "See carrier availability at every door before you knock.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "Lead CRM + Sales Logger",
    desc: "Track every door, note, and sale with an immutable audit trail.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Compliance & No Solicitation",
    desc: "QR-based opt-outs, Do Not Knock lists, and full manager signoffs.",
  },
  {
    icon: (
      <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "AI Coaching",
    desc: "Objection scripts, pitch variations, and next-best-action suggestions.",
  },
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
      <div className="flex flex-col items-center min-h-[85vh] py-12">
        <img src="/brand/rouxte-logo.png" alt="Rouxte" className="h-9 mb-4" />

        <h1 className="text-3xl font-semibold text-gray-900 text-center mb-2">
          Built for the field
        </h1>
        <p className="text-gray-500 text-center max-w-sm mb-10">
          Everything your team needs to knock smarter, sell faster, and stay protected.
        </p>

        <div className="grid grid-cols-1 gap-4 w-full max-w-lg mb-10">
          {features.map((f) => (
            <Card key={f.title} padding="md">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                  {f.icon}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{f.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Button size="lg" className="w-full max-w-lg" onClick={proceed}>
          Set Up My Profile
        </Button>
      </div>
    </ScreenShell>
  );
}
