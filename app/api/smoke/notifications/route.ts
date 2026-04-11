import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import {
  inviteEmail,
  inviteAcceptedEmail,
  onboardingCompleteRepEmail,
  onboardingCompleteManagerEmail,
  paystubEmail,
  paystubReleasedEmail,
  orderConfirmationEmail,
} from "@/lib/email/templates";

// POST /api/smoke/notifications
// Admin-only: sends one test email of every type to the caller's email address.
// Returns a result object showing pass/skip/fail per notification type.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("role, full_name, org_id").eq("user_id", user.id).maybeSingle();

  if (!profile || !["admin", "sales_manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden — admin/manager only" }, { status: 403 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const { data: org } = await admin.from("orgs").select("name").eq("id", profile.org_id).maybeSingle();
  const origin  = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rouxte.com";
  const to      = user.email!;
  const orgName = org?.name ?? "Demo Org";
  const repName = profile.full_name ?? "Test Rep";

  const tests: Array<{ name: string; tpl: { subject: string; html: string } }> = [
    {
      name: "invite_sent",
      tpl: inviteEmail({
        orgName, role: "sales_rep",
        inviteUrl: `${origin}/invite/smoke-test-token`,
        inviterName: repName,
      }),
    },
    {
      name: "invite_accepted",
      tpl: inviteAcceptedEmail({
        repName: "Alex Johnson", repEmail: "alex@example.com",
        orgName, role: "sales_rep",
        dashUrl: `${origin}/manager`,
      }),
    },
    {
      name: "onboarding_complete_rep",
      tpl: onboardingCompleteRepEmail({ repName, orgName, dashUrl: `${origin}/dashboard` }),
    },
    {
      name: "onboarding_complete_manager",
      tpl: onboardingCompleteManagerEmail({
        repName: "Alex Johnson", repEmail: "alex@example.com",
        orgName, dashUrl: `${origin}/manager`,
      }),
    },
    {
      name: "paystub_generated",
      tpl: paystubEmail({
        repName, periodLabel: "Apr 7 – Apr 13",
        netPay: 1842.50, viewUrl: `${origin}/payroll/stubs/smoke-test/print`,
      }),
    },
    {
      name: "paystub_released",
      tpl: paystubReleasedEmail({
        repName, periodLabel: "Apr 7 – Apr 13",
        netPay: 1842.50, viewUrl: `${origin}/payroll/stubs/smoke-test/print`,
      }),
    },
    {
      name: "order_confirmation",
      tpl: orderConfirmationEmail({
        buyerName: repName, productLabel: "ID Badge — Digital Download",
        totalCents: 799, orderId: "smoke-test-order-id",
        dashUrl: `${origin}/store`,
      }),
    },
  ];

  const results: Record<string, "sent" | "failed"> = {};

  for (const test of tests) {
    try {
      await sendEmail({ from: FROM, to, subject: `[SMOKE TEST] ${test.tpl.subject}`, html: test.tpl.html });
      results[test.name] = "sent";
    } catch {
      results[test.name] = "failed";
    }
  }

  const allPassed = Object.values(results).every((r) => r === "sent");

  return NextResponse.json({
    ok:      allPassed,
    sent_to: to,
    results,
    summary: `${Object.values(results).filter(r => r === "sent").length}/${tests.length} sent`,
  });
}
