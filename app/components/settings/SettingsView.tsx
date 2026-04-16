"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import Card from "@/components/ui/Card";
import Link from "next/link";

const SERVICE_TYPES = [
  { value: "fiber",           label: "Fiber" },
  { value: "cable",           label: "Cable" },
  { value: "fixed_wireless",  label: "Fixed Wireless" },
  { value: "5g",              label: "5G Home Internet" },
  { value: "dsl",             label: "DSL" },
];

function OrgSettingsCard() {
  const [orgName, setOrgName] = useState("");
  const [providerName, setProviderName] = useState("");
  const [serviceType, setServiceType] = useState("fiber");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/org/settings").then((r) => r.json()).then((d) => {
      if (d.data) {
        setOrgName(d.data.name ?? "");
        setProviderName(d.data.provider_name ?? "");
        setServiceType(d.data.service_type ?? "fiber");
      }
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/org/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName, provider_name: providerName, service_type: serviceType }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card padding="md">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Organization</p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Company name</label>
          <input value={orgName} onChange={(e) => setOrgName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Provider name <span className="text-gray-400">(shown to reps in the app)</span></label>
          <input value={providerName} onChange={(e) => setProviderName(e.target.value)}
            placeholder="e.g. AT&T Fiber, Brightspeed, Frontier…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Service type</label>
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
            {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button onClick={save} disabled={saving}
          className="mt-1 rounded-xl bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
        </button>
      </div>
    </Card>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Owner / Admin",
  sales_manager: "Sales Manager",
  team_lead: "Team Lead",
  sales_rep: "Sales Rep",
};

function DigitalCardCard() {
  const { profile } = useProfile();
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetch("/api/me/phone").then((r) => r.json()).then((d) => {
      if (d.phone) setPhone(d.phone);
    });
  }, [profile]);

  async function savePhone() {
    setSaving(true);
    await fetch("/api/me/phone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function copyCardLink() {
    if (!profile) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    await navigator.clipboard.writeText(`${appUrl}/card/${profile.user_id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!profile) return null;

  const cardUrl = `/card/${profile.user_id}`;

  return (
    <Card padding="md">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Digital Card</p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. (555) 867-5309"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button onClick={savePhone} disabled={saving}
          className="rounded-xl bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Phone"}
        </button>
        <div className="flex gap-2 mt-1">
          <Link href={cardUrl} target="_blank"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Preview Card
          </Link>
          <button onClick={copyCardLink}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function SettingsView() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Account and preferences</p>
      </div>

      {/* Profile card */}
      <Card padding="md">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Account</p>
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-1/3" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm font-medium text-gray-900">{profile?.full_name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900">{profile?.email ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Role</span>
              <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role ?? "—"}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Digital card — all roles */}
      <DigitalCardCard />

      {/* Org settings — admin only */}
      {profile?.role === "admin" && <OrgSettingsCard />}

      {/* Manager tools — elevated roles only */}
      {(profile?.role === "admin" || profile?.role === "sales_manager") && (
        <Card padding="md">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Management</p>
          <div className="flex flex-col gap-1">
            {[
              { href: "/manager/people",       label: "People & Invites" },
              { href: "/manager/teams",         label: "Teams" },
              { href: "/manager/compensation",  label: "Commission Packages" },
              { href: "/manager/payroll",       label: "Payroll" },
              { href: "/manager/goals",         label: "Goals" },
              { href: "/manager/onboarding",    label: "Onboarding Documents" },
              { href: "/manager/compliance",    label: "Compliance Log" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors group"
              >
                <span className="text-sm text-gray-700">{label}</span>
                <svg className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Rep quick links */}
      {profile?.role === "sales_rep" && (
        <Card padding="md">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Quick Links</p>
          <div className="flex flex-col gap-1">
            {[
              { href: "/payroll",  label: "My Paystubs" },
              { href: "/leads",    label: "My Leads" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors group">
                <span className="text-sm text-gray-700">{label}</span>
                <svg className="h-4 w-4 text-gray-300 group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Sign out */}
      <Card padding="md">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Session</p>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </Card>
    </div>
  );
}
