"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ScreenShell from "@/components/ScreenShell";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { UserRole } from "@/lib/types";

const roleOptions = [
  { value: "sales_rep", label: "Sales Rep" },
  { value: "team_lead", label: "Team Lead" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "admin", label: "Admin / Owner" },
];

const carrierOptions = [
  { value: "", label: "No preference" },
  { value: "att", label: "AT&T" },
  { value: "comcast", label: "Comcast" },
  { value: "spectrum", label: "Spectrum" },
  { value: "frontier", label: "Frontier" },
  { value: "other", label: "Other" },
];

export default function ProfileSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    role: "sales_rep" as UserRole,
    territory: "",
    carrier_focus: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding/complete-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "complete", profile: form }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `Server error ${res.status}`);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell>
      <div className="flex flex-col items-center min-h-[85vh] py-12">
        <img src="/brand/rouxte-logo.png" alt="Rouxte" className="h-9 mb-8" />

        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Set up your profile</h1>
          <p className="text-sm text-gray-500 mb-8">
            Tell us a bit about yourself so your team can find you.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Full Name"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Jane Smith"
              required
            />

            <Select
              label="Your Role"
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              options={roleOptions}
            />

            <Input
              label="Territory / Area"
              value={form.territory}
              onChange={(e) => update("territory", e.target.value)}
              placeholder="e.g. South Austin, TX"
              hint="Optional — helps managers assign leads in your area"
            />

            <Select
              label="Carrier Focus"
              value={form.carrier_focus}
              onChange={(e) => update("carrier_focus", e.target.value)}
              options={carrierOptions}
            />

            {error && (
              <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full mt-2">
              Finish Setup
            </Button>
          </form>
        </div>
      </div>
    </ScreenShell>
  );
}
