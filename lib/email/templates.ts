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
    <p style="margin:0;font-size:11px;color:#cbd5e1;">Rouxte · Fiber Sales Platform</p>
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
  return `<a href="${href}" style="display:block;background:#0f172a;color:#ffffff;text-align:center;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:24px;">${label} →</a>`;
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// ── Invite ────────────────────────────────────────────────────────────────────
export function inviteEmail({ orgName, role, inviteUrl, inviterName }: {
  orgName: string; role: string; inviteUrl: string; inviterName: string;
}): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABELS[role] ?? role;
  return {
    subject: `You've been invited to join ${orgName} on Rouxte`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">You're invited!</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">${inviterName} has invited you to join <strong>${orgName}</strong> as a <strong>${roleLabel}</strong> on Rouxte.</p>
      ${cta(inviteUrl, "Accept Invitation")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">This invitation expires in 7 days. If you didn't expect this, you can ignore this email.</p>
    `),
    text: `${inviterName} has invited you to join ${orgName} as a ${roleLabel} on Rouxte.\n\nAccept: ${inviteUrl}`,
  };
}

export function inviteAcceptedEmail({ repName, repEmail, orgName, role, dashUrl }: {
  repName: string; repEmail: string; orgName: string; role: string; dashUrl: string;
}): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABELS[role] ?? role;
  return {
    subject: `${repName} has joined ${orgName}`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">${repName} is now on board</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;"><strong>${repName}</strong> (${repEmail}) has accepted their invitation and joined <strong>${orgName}</strong> as a <strong>${roleLabel}</strong>.</p>
      ${cta(dashUrl, "View Team")}
    `),
    text: `${repName} (${repEmail}) has joined ${orgName} as a ${roleLabel}.\n\nView team: ${dashUrl}`,
  };
}

export function onboardingCompleteRepEmail({ repName, orgName, dashUrl }: {
  repName: string; orgName: string; dashUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Welcome to Rouxte, ${repName}!`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">You're all set, ${repName}!</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Your account with <strong>${orgName}</strong> is ready. Head to your dashboard to start tracking leads, building quotes, and logging activity.</p>
      ${cta(dashUrl, "Go to Dashboard")}
    `),
    text: `Welcome to Rouxte, ${repName}! Your account with ${orgName} is ready.\n\nDashboard: ${dashUrl}`,
  };
}

export function onboardingCompleteManagerEmail({ repName, repEmail, orgName, dashUrl }: {
  repName: string; repEmail: string; orgName: string; dashUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `${repName} completed onboarding`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">${repName} is ready to sell</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;"><strong>${repName}</strong> (${repEmail}) has completed onboarding for <strong>${orgName}</strong>.</p>
      ${cta(dashUrl, "View Team")}
    `),
    text: `${repName} (${repEmail}) has completed onboarding for ${orgName}.\n\nView team: ${dashUrl}`,
  };
}

export function paystubEmail({ repName, periodLabel, netPay, viewUrl }: {
  repName: string; periodLabel: string; netPay: number; viewUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Your paystub for ${periodLabel} is ready`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Paystub ready</p>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;">Hi ${repName}, your earnings statement for <strong>${periodLabel}</strong> is available.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">Net Pay</p>
        <p style="margin:0;font-size:36px;font-weight:800;color:#15803d;">${fmt(netPay)}</p>
      </div>
      ${cta(viewUrl, "View Paystub")}
    `),
    text: `Hi ${repName}, your paystub for ${periodLabel} is ready. Net pay: ${fmt(netPay)}.\n\nView: ${viewUrl}`,
  };
}

export function paystubReleasedEmail({ repName, periodLabel, netPay, viewUrl }: {
  repName: string; periodLabel: string; netPay: number; viewUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Paystub released — ${periodLabel}`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Paystub released</p>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;">Hi ${repName}, your manager has released your paystub for <strong>${periodLabel}</strong>.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#16a34a;text-transform:uppercase;letter-spacing:0.5px;">Net Pay</p>
        <p style="margin:0;font-size:36px;font-weight:800;color:#15803d;">${fmt(netPay)}</p>
      </div>
      ${cta(viewUrl, "View Paystub")}
    `),
    text: `Hi ${repName}, your paystub for ${periodLabel} has been released. Net pay: ${fmt(netPay)}.\n\nView: ${viewUrl}`,
  };
}

export function leadAssignedEmail({ repName, leadCount, leadAddress, assignerName, orgName, leadsUrl }: {
  repName: string; leadCount: number; leadAddress: string; assignerName: string; orgName: string; leadsUrl: string;
}): { subject: string; html: string; text: string } {
  const plural = leadCount !== 1;
  return {
    subject: `${leadCount} new lead${plural ? "s" : ""} assigned to you`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">New lead${plural ? "s" : ""} assigned</p>
      <p style="margin:0 0 16px;font-size:15px;color:#475569;">Hi ${repName}, <strong>${assignerName}</strong> from <strong>${orgName}</strong> has assigned you ${leadCount} new lead${plural ? "s" : ""}.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:11px;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;">Lead${plural ? "s" : ""}</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#1e40af;">${leadAddress}${plural ? " + more" : ""}</p>
      </div>
      ${cta(leadsUrl, "View My Leads")}
    `),
    text: `Hi ${repName}, ${assignerName} has assigned you ${leadCount} new lead${plural ? "s" : ""}.\n\nView: ${leadsUrl}`,
  };
}

export function terminationEmail({ repName, orgName, managerName, payUrl }: {
  repName: string; orgName: string; managerName: string; payUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Important: Your account with ${orgName}`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Account update</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">Hi ${repName}, <strong>${managerName}</strong> has ended your active status with <strong>${orgName}</strong>. Your final earnings summary is available below.</p>
      ${cta(payUrl, "View Final Earnings")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Questions? Contact ${managerName} or support@rouxte.com</p>
    `),
    text: `Hi ${repName}, your active status with ${orgName} has ended. View final earnings: ${payUrl}`,
  };
}

// ── Store order confirmation ──────────────────────────────────────────────────
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

// ── Fiber quote ───────────────────────────────────────────────────────────────
export function fiberQuoteEmail({ customerName, repName, repPhone, repEmail, orgName, quoteUrl }: {
  customerName: string; repName: string; repPhone?: string; repEmail?: string;
  orgName: string; quoteUrl: string;
}): { subject: string; html: string; text: string } {
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";
  const repContact = [repPhone, repEmail].filter(Boolean).join(" · ");
  return {
    subject: `Your Fiber Quote from ${orgName}`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your fiber quote is ready</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">${greeting} Thank you for speaking with ${repName} from ${orgName} today. Your fiber internet quote is attached as a PDF and available online.</p>
      ${cta(quoteUrl, "View Your Quote")}
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Your Rep</p>
        <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#0f172a;">${repName}</p>
        ${repContact ? `<p style="margin:0;font-size:13px;color:#64748b;">${repContact}</p>` : ""}
      </div>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Pricing and promotions subject to change. Quote generated via Rouxte.</p>
    `),
    text: `${greeting}\n\nThank you for speaking with ${repName} from ${orgName}. Your fiber quote is attached as a PDF.\n\nView online: ${quoteUrl}\n\n${repContact ? `Contact: ${repContact}` : ""}`,
  };
}

// ── Wireless quote ────────────────────────────────────────────────────────────
export function wirelessQuoteEmail({ customerName, repName, repPhone, repEmail, orgName, quoteUrl }: {
  customerName: string; repName: string; repPhone?: string; repEmail?: string;
  orgName: string; quoteUrl: string;
}): { subject: string; html: string; text: string } {
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";
  const repContact = [repPhone, repEmail].filter(Boolean).join(" · ");
  return {
    subject: `Your Wireless Quote from ${orgName}`,
    html: wrapper(`
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">Your wireless quote is ready</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;">${greeting} Thank you for speaking with ${repName} from ${orgName} today. Your AT&amp;T wireless quote is attached as a PDF and available online.</p>
      ${cta(quoteUrl, "View Your Quote")}
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 16px;">
        <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Your Rep</p>
        <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#0f172a;">${repName}</p>
        ${repContact ? `<p style="margin:0;font-size:13px;color:#64748b;">${repContact}</p>` : ""}
      </div>
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Pricing, plans, and promotions subject to change. Quote generated via Rouxte.</p>
    `),
    text: `${greeting}\n\nThank you for speaking with ${repName} from ${orgName}. Your wireless quote is attached as a PDF.\n\nView online: ${quoteUrl}\n\n${repContact ? `Contact: ${repContact}` : ""}`,
  };
}
