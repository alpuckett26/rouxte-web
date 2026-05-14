/**
 * Super-admin allow-list. Server-only env (SUPER_ADMIN_EMAILS) is the source
 * of truth. The client learns its super-admin status via /api/me, never by
 * checking the env directly.
 *
 * A super-admin is a platform operator (not an org admin) and bypasses:
 *  - BillingGate / PricingModal
 *  - Onboarding step redirects
 *  - Trial banner
 *  - AI rate limits
 *  - (Phase 2) RLS org scoping for cross-org troubleshooting
 */

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = parseList(process.env.SUPER_ADMIN_EMAILS);
  return list.includes(email.toLowerCase());
}
