const ROLE_LABELS: Record<string, string> = {
  sales_rep: "Sales Rep",
  team_lead: "Team Lead",
  sales_manager: "Sales Manager",
  admin: "Admin",
};

const HEADER = `
  <tr><td style="background:#0a0f1e;padding:28px 32px;text-align:center;">
    <div style="font-size:28px;font-weight:900;letter-spacing:-1px;">
      <span style="color:#1BAEE1">ROU</span><span style="color:#72C41A">X</span><span style="color:#1BAEE1">TE</span>
    </div>
  </td></tr>`;

const FOOTER = `
  <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center;">
    <p style="margin:0;font-size:11px;color:#cbd5e1;">Rouxte &middot; Fiber Sales Platform</p>
  </td></tr>`;

function wrapper(inner: string) {
  return `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
        ${HEADER}
        <tr><td style="padding:32px;">${inner}</td></tr>
        ${FOOTER}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function cta(href: string, label: string) {
  return `<a href="${href}" style="display:block;background:#0f172a;color:#ffffff;text-align:center;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:24px;">${label} &rarr;</a>`;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// ── Invite ────────────────────────────────────────────────────────────────────────────
export function inviteEmail({ orgName, role, inviteUrl, inviterName }: {
  orgName: string; role: string; inviteUrl: string; inviterName?: string;
}): { subject: string; html: string } {
  const roleLabel = ROLE_LABELS[role] ?? role;
  const from = inviterName ? `${inviterName} has invited you` : "You've been invited";
  return {
    subject: `You've been invited to join ${orgName} on Rouxte`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">${from}</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">to join <strong>${orgName}</strong> as a <strong>${roleLabel}</strong>.</p>
      <a href="${inviteUrl}" style="display:block;background:#1BAEE1;color:#ffffff;text-align:center;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:24px;">Accept Invite &rarr;</a>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">This invite expires in 7 days. If you didn't expect this, you can safely ignore it.</p>
    `),
  };
}

// ── Invite accepted (to manager) ─────────────────────────────────────────────────────
export function inviteAcceptedEmail({ repName, repEmail, orgName, role, dashUrl }: {
  repName: string; repEmail: string; orgName: string; role: string; dashUrl: string;
}): { subject: string; html: string } {
  const roleLabel = ROLE_LABELS[role] ?? role;
  return {
    subject: `${repName} has joined ${orgName} on Rouxte`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">New team member joined</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;"><strong>${repName}</strong> (${repEmail}) has accepted their invite and joined <strong>${orgName}</strong> as a <strong>${roleLabel}</strong>.</p>
      ${cta(dashUrl, "View Team")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Their onboarding is in progress. You'll receive an update when they complete it.</p>
    `),
  };
}

// ── Onboarding complete (to rep) ───────────────────────────────────────────────────────────────
export function onboardingCompleteRepEmail({ repName, orgName, dashUrl }: {
  repName: string; orgName: string; dashUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `You're all set — welcome to ${orgName}!`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Onboarding complete 🎉</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Hi <strong>${repName}</strong>, you've finished onboarding with <strong>${orgName}</strong>. Your manager will clear you to work the field once they've reviewed your profile.</p>
      ${cta(dashUrl, "Go to Dashboard")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Check your training modules while you wait — passing them all makes you promotion eligible.</p>
    `),
  };
}

// ── Onboarding complete (to manager) ─────────────────────────────────────────────────────
export function onboardingCompleteManagerEmail({ repName, repEmail, orgName, dashUrl }: {
  repName: string; repEmail: string; orgName: string; dashUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${repName} has completed onboarding`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Onboarding complete</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;"><strong>${repName}</strong> (${repEmail}) has signed all required documents and completed onboarding for <strong>${orgName}</strong>. They're waiting on your field clearance.</p>
      ${cta(dashUrl, "Review & Clear Rep")}
    `),
  };
}

// ── Paystub generated / available ────────────────────────────────────────────────────────────────
export function paystubEmail({ repName, periodLabel, netPay, viewUrl }: {
  repName: string; periodLabel: string; netPay: number; viewUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Your pay for ${periodLabel} is ready — ${fmt(netPay)}`,
    html: wrapper(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Pay Statement Ready</p>
      <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#0f172a;">Hi ${repName},</p>
      <p style="margin:0 0 8px;font-size:15px;color:#475569;">Your pay for <strong>${periodLabel}</strong> is ready.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
        <p style="margin:0 0 4px;font-size:13px;color:#16a34a;">Net Pay</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#15803d;">${fmt(netPay)}</p>
      </div>
      ${cta(viewUrl, "View Full Paystub")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Remember to set aside ~27% for self-employment taxes (SE: 15.3% + federal est: 12%).</p>
    `),
  };
}

// ── Paystub released ─────────────────────────────────────────────────────────────────────────────────
export function paystubReleasedEmail({ repName, periodLabel, netPay, viewUrl }: {
  repName: string; periodLabel: string; netPay: number; viewUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `💰 Your pay is released — ${fmt(netPay)}`,
    html: wrapper(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Pay Released</p>
      <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#0f172a;">Your pay is on the way, ${repName}!</p>
      <p style="margin:0 0 8px;font-size:15px;color:#475569;">Your paystub for <strong>${periodLabel}</strong> has been approved and released by your manager.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
        <p style="margin:0 0 4px;font-size:13px;color:#2563eb;">Net Pay</p>
        <p style="margin:0;font-size:32px;font-weight:800;color:#1d4ed8;">${fmt(netPay)}</p>
      </div>
      ${cta(viewUrl, "View & Print Paystub")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Remember to set aside ~27% for self-employment taxes.</p>
    `),
  };
}

// ── Lead assigned ─────────────────────────────────────────────────────────────────────────────────
export function leadAssignedEmail({ repName, leadCount, leadAddress, assignerName, orgName, leadsUrl }: {
  repName: string; leadCount: number; leadAddress?: string;
  assignerName: string; orgName: string; leadsUrl: string;
}): { subject: string; html: string } {
  const isOne = leadCount === 1;
  return {
    subject: isOne
      ? `New lead assigned to you — ${orgName}`
      : `${leadCount} new leads assigned to you — ${orgName}`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
        ${isOne ? "You have a new lead" : `${leadCount} leads assigned to you`}
      </p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">
        Hi <strong>${repName}</strong>, <strong>${assignerName}</strong> has assigned
        ${isOne
          ? `a lead${leadAddress ? ` at <strong>${leadAddress}</strong>` : ""}`
          : `<strong>${leadCount} leads</strong>`}
        to you in <strong>${orgName}</strong>.
      </p>
      ${cta(leadsUrl, "View My Leads")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
        Open your leads pipeline and get started.
      </p>
    `),
  };
}
// ── Termination ──────────────────────────────────────────────────────────────────────────────────
export function terminationEmail({ repName, orgName, managerName, payUrl }: {
  repName: string; orgName: string; managerName?: string; payUrl: string;
}): { subject: string; html: string } {
  const sender = managerName ? `${managerName} from ${orgName}` : orgName;
  return {
    subject: `Your position with ${orgName} has ended`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your position has ended</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Hi <strong>${repName}</strong>, ${sender} has ended your role at <strong>${orgName}</strong>.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#0f172a;">Next steps</p>
        <ul style="margin:0;padding-left:18px;font-size:14px;color:#475569;line-height:2;">
          <li>Your final pay will be calculated and released by your manager</li>
          <li>Any outstanding commissions from closed deals are included</li>
          <li>Your full pay history is available at the link below</li>
          <li>Questions? Reply to this email or reach out to your manager directly</li>
        </ul>
      </div>
      ${cta(payUrl, "View Pay History")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Thank you for your time with ${orgName}.</p>
    `),
  };
}

// ── Fiber quote (to customer) ────────────────────────────────────────────────────────────────────────
export function fiberQuoteEmail({ customerName, repName, orgName, planLabel, planSpeed, monthly, quoteUrl, promoNote }: {
  customerName: string; repName: string; orgName: string;
  planLabel: string; planSpeed: string; monthly: number;
  quoteUrl: string; promoNote?: string;
}): { subject: string; html: string } {
  const promoBlock = promoNote ? `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.06em;">Current Promotion</p>
      <p style="margin:0;font-size:14px;color:#166534;">${promoNote}</p>
    </div>` : "";

  return {
    subject: `Your AT&T Fiber Internet Quote — ${planLabel}`,
    html: wrapper(`
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Fiber Internet Quote</p>
      <p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#0f172a;">Hi${customerName ? ` ${customerName}` : ""},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">
        <strong>${repName}</strong> from <strong>${orgName}</strong> has prepared a fiber internet quote for you.
      </p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#3b82f6;">${planLabel} &middot; ${planSpeed}</p>
        <p style="margin:0;font-size:36px;font-weight:800;color:#1d4ed8;">${fmt(monthly)}<span style="font-size:16px;font-weight:500;color:#60a5fa;">/mo</span></p>
        <p style="margin:4px 0 0;font-size:12px;color:#93c5fd;">Estimated monthly total &middot; excludes taxes &amp; fees</p>
      </div>
      ${promoBlock}
      ${cta(quoteUrl, "View My Full Quote")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
        No activation fee &middot; Gateway included &middot; No annual contract<br>
        Pricing subject to change. Questions? Reply to your rep directly.
      </p>
    `),
  };
}

// ── Store order confirmation ──────────────────────────────────────────────────────────────────────
export function orderConfirmationEmail({ buyerName, productLabel, totalCents, orderId, dashUrl }: {
  buyerName: string; productLabel: string; totalCents: number; orderId: string; dashUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Order confirmed — ${productLabel}`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Order confirmed!</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Thanks ${buyerName}, your order for <strong>${productLabel}</strong> has been received and is being processed.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Order summary</p>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:15px;color:#0f172a;">${productLabel}</span>
          <span style="font-size:15px;font-weight:600;color:#0f172a;">${fmt(totalCents / 100)}</span>
        </div>
        <p style="margin:8px 0 0;font-size:11px;color:#94a3b8;">Order #${orderId.slice(0, 8).toUpperCase()}</p>
      </div>
      ${cta(dashUrl, "View Order Status")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Physical badges ship USPS First Class (5-7 business days). Questions? support@rouxte.com</p>
    `),
  };
}
