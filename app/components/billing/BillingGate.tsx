"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PricingModal from "./PricingModal";
import TrialBanner from "./TrialBanner";

interface BillingStatus {
  org_id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "suspended";
  tier_key: string;
  trial_started_at: string;
  trial_ends_at: string;
  days_left: number;
  is_in_trial: boolean;
  has_active_access: boolean;
  needs_payment: boolean;
  viewer_is_admin: boolean;
  square_card_id: string | null;
  billing_email: string | null;
  billing_name: string | null;
}

/**
 * Wraps the authenticated app:
 *   - shows the PricingModal when an org has no subscription / is suspended
 *   - shows the TrialBanner during the free-trial period
 *   - skips itself entirely on routes that must stay open (onboarding,
 *     getting-started, public pricing, billing manager)
 */
export default function BillingGate({ email, name }: { email?: string; name?: string }) {
  const pathname = usePathname() ?? "";
  const [status, setStatus] = useState<BillingStatus | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setStatus(j.data ?? null); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, []);

  // Don't gate certain routes (otherwise users can never finish billing)
  const skipGate =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/getting-started") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/auth");

  if (skipGate || status === "loading") return null;

  // No subscription row, or canceled/suspended — show modal
  const needsToSubscribe =
    status === null ||
    status.status === "canceled" ||
    status.status === "suspended";

  if (needsToSubscribe) {
    return (
      <PricingModal
        defaultEmail={email}
        defaultName={name}
        onComplete={() => window.location.reload()}
      />
    );
  }

  // Trial countdown
  if (status.is_in_trial) {
    return <TrialBanner daysLeft={status.days_left} tierKey={status.tier_key} />;
  }

  // Past-due grace state — soft warning banner
  if (status.status === "past_due") {
    return <TrialBanner daysLeft={0} tierKey={status.tier_key} pastDue />;
  }

  return null;
}
