import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, FROM } from "@/lib/email/resend";
import { leadAssignedEmail } from "@/lib/email/templates";

interface LeadAssignOpts {
  orgId: string;
  /** user_id of the person receiving the leads */
  recipientId: string;
  leadCount: number;
  /** address of a single lead (omit for bulk) */
  leadAddress?: string;
  assignerName: string;
  assignerUserId: string;
}

/** Creates an in-app notification and sends an email for a lead assignment. */
export async function notifyLeadAssigned(opts: LeadAssignOpts): Promise<void> {
  const admin = createAdminClient();

  const [profileResult, authResult, orgResult] = await Promise.all([
    admin
      .from("user_profiles")
      .select("full_name, notification_prefs")
      .eq("user_id", opts.recipientId)
      .eq("org_id", opts.orgId)
      .maybeSingle(),
    admin.auth.admin.getUserById(opts.recipientId),
    admin.from("orgs").select("name").eq("id", opts.orgId).single(),
  ]);

  const recipient = profileResult.data;
  const email     = authResult.data?.user?.email;
  const orgName   = orgResult.data?.name ?? "your team";

  if (!recipient) return;

  const isOne  = opts.leadCount === 1;
  const title  = isOne ? "New lead assigned to you" : `${opts.leadCount} leads assigned to you`;
  const body   = isOne && opts.leadAddress
    ? `${opts.assignerName} assigned "${opts.leadAddress}" to you`
    : `${opts.assignerName} assigned ${opts.leadCount} lead${opts.leadCount !== 1 ? "s" : ""} to you`;

  // In-app notification (fire-and-forget — non-fatal)
  await admin.from("notifications").insert({
    user_id:    opts.recipientId,
    org_id:     opts.orgId,
    type:       "lead_assigned",
    title,
    body,
    data: {
      lead_count:        opts.leadCount,
      lead_address:      opts.leadAddress ?? null,
      assigner_name:     opts.assignerName,
      assigner_user_id:  opts.assignerUserId,
    },
  }).then(({ error }) => {
    if (error) console.error("[notify] insert failed:", error.message);
  });

  // Email — respect notification_prefs (opt-out with prefs.email_lead_assigned === false)
  const prefs = (recipient.notification_prefs ?? {}) as Record<string, boolean>;
  if (email && prefs.email_lead_assigned !== false) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rouxte.com";
    const { subject, html } = leadAssignedEmail({
      repName:      recipient.full_name,
      leadCount:    opts.leadCount,
      leadAddress:  opts.leadAddress ?? "",
      assignerName: opts.assignerName,
      orgName,
      leadsUrl:     `${appUrl}/leads`,
    });
    await sendEmail({ from: FROM, to: email, subject, html });
  }
}
