const ROLE_LABELS: Record<string, string> = {
  sales_rep: "Sales Rep",
  team_lead: "Team Lead",
  sales_manager: "Sales Manager",
  admin: "Admin",
};

export function inviteEmail({
  orgName,
  role,
  inviteUrl,
  inviterName,
}: {
  orgName: string;
  role: string;
  inviteUrl: string;
  inviterName?: string;
}): { subject: string; html: string } {
  const roleLabel = ROLE_LABELS[role] ?? role;
  const from = inviterName ? `${inviterName} has invited you` : "You've been invited";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#0a0f1e;padding:28px 32px;text-align:center;">
          <div style="font-size:28px;font-weight:900;letter-spacing:-1px;">
            <span style="color:#1BAEE1">ROU</span><span style="color:#72C41A">X</span><span style="color:#1BAEE1">TE</span>
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">${from}</p>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;">
            to join <strong>${orgName}</strong> as a <strong>${roleLabel}</strong>.
          </p>

          <a href="${inviteUrl}"
            style="display:block;background:#1BAEE1;color:#ffffff;text-align:center;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:24px;">
            Accept Invite →
          </a>

          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            This invite expires in 7 days. If you didn't expect this email, you can safely ignore it.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center;">
          <p style="margin:0;font-size:11px;color:#cbd5e1;">Rouxte · Fiber Sales Platform</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: `You've been invited to join ${orgName} on Rouxte`,
    html,
  };
}

export function paystubEmail({
  repName,
  periodLabel,
  netPay,
  viewUrl,
}: {
  repName: string;
  periodLabel: string;
  netPay: number;
  viewUrl: string;
}): { subject: string; html: string } {
  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

        <tr><td style="background:#0a0f1e;padding:28px 32px;text-align:center;">
          <div style="font-size:28px;font-weight:900;letter-spacing:-1px;">
            <span style="color:#1BAEE1">ROU</span><span style="color:#72C41A">X</span><span style="color:#1BAEE1">TE</span>
          </div>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Pay Statement Ready</p>
          <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#0f172a;">Hi ${repName},</p>
          <p style="margin:0 0 8px;font-size:15px;color:#475569;">Your pay for <strong>${periodLabel}</strong> is ready.</p>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
            <p style="margin:0 0 4px;font-size:13px;color:#16a34a;">Net Pay</p>
            <p style="margin:0;font-size:32px;font-weight:800;color:#15803d;">${fmt(netPay)}</p>
          </div>

          <a href="${viewUrl}"
            style="display:block;background:#0f172a;color:#ffffff;text-align:center;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:24px;">
            View Full Paystub →
          </a>

          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            Remember to set aside ~27% for self-employment taxes (SE: 15.3% + federal est: 12%).
          </p>
        </td></tr>

        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center;">
          <p style="margin:0;font-size:11px;color:#cbd5e1;">Rouxte · Fiber Sales Platform</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: `Your pay for ${periodLabel} is ready — ${fmt(netPay)}`,
    html,
  };
}
