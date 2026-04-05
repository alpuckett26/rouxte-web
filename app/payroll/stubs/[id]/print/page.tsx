import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface Params { params: Promise<{ id: string }> }

interface LineItem {
  type: string;
  hours?: number;
  rate?: number;
  gross?: number;
  commission_amount?: number;
  commission_pct?: number;
  payout_amount?: number;
  package?: string;
  customer_name?: string;
  tier_name?: string;
  date?: string;
  reason?: string;
  amount?: number;
  name?: string;
}

export default async function PrintStubPage({ params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles").select("org_id, role, full_name").eq("user_id", user.id).maybeSingle();
  if (!profile) redirect("/auth");

  const isManager = ["admin", "sales_manager", "team_lead"].includes(profile.role);

  const { data: stub } = await admin
    .from("paystubs").select("*").eq("id", id).eq("org_id", profile.org_id).maybeSingle();
  if (!stub) redirect("/payroll");

  // Only manager OR the rep themselves (if released)
  if (!isManager && (stub.user_id !== user.id || stub.status !== "released")) redirect("/payroll");

  const { data: repProfile } = await admin
    .from("user_profiles").select("full_name").eq("user_id", stub.user_id).maybeSingle();

  const { data: org } = await admin
    .from("organizations").select("name").eq("id", profile.org_id).maybeSingle();

  const fmt = (n: number) => `$${Number(n).toFixed(2)}`;
  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const fmtShort = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const lineItems: LineItem[] = (stub.line_items as LineItem[]) ?? [];
  const saleItems = lineItems.filter((l) => l.type === "sale");
  const chargebackItems = lineItems.filter((l) => l.type === "chargeback");
  const bonusItems = lineItems.filter((l) => l.type === "bonus");
  const hoursItem = lineItems.find((l) => l.type === "hours");

  return (
    <html>
      <head>
        <title>Paystub — {repProfile?.full_name ?? "Rep"}</title>
        <style>{`
          @media print { body { margin: 0; } .no-print { display: none !important; } }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 24px; color: #111; }
          .stub { background: white; max-width: 720px; margin: 0 auto; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
          .header { background: #1e40af; color: white; padding: 24px 32px; }
          .header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
          .header p { margin: 0; opacity: 0.85; font-size: 14px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #e5e7eb; }
          .meta-cell { padding: 16px 32px; }
          .meta-cell:first-child { border-right: 1px solid #e5e7eb; }
          .meta-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .meta-value { font-size: 15px; font-weight: 600; }
          .section { padding: 0 32px 24px; }
          .section-title { font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 12px; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th { text-align: left; padding: 8px 0; font-size: 12px; color: #6b7280; font-weight: 500; border-bottom: 1px solid #f3f4f6; }
          td { padding: 8px 0; border-bottom: 1px solid #f9fafb; }
          .amount { text-align: right; }
          .summary { background: #f9fafb; border-top: 2px solid #e5e7eb; padding: 24px 32px; }
          .summary-row { display: flex; justify-content: space-between; font-size: 15px; margin-bottom: 8px; }
          .summary-row.total { font-size: 22px; font-weight: 700; color: #1e40af; padding-top: 12px; border-top: 2px solid #e5e7eb; margin-top: 8px; }
          .status-badge { display: inline-block; border-radius: 9999px; padding: 2px 10px; font-size: 12px; font-weight: 600; background: #d1fae5; color: #065f46; }
          .print-btn { display: block; margin: 16px auto 0; padding: 10px 24px; background: #1e40af; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        `}</style>
      </head>
      <body>
        <div className="no-print" style={{ maxWidth: 720, margin: "0 auto 16px", display: "flex", gap: 8 }}>
          <button className="print-btn" onClick={() => window.print()} style={{ margin: 0 }}>Print / Save PDF</button>
          <a href="/payroll" style={{ display: "inline-flex", alignItems: "center", padding: "10px 16px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14, color: "#374151", textDecoration: "none", background: "white" }}>← Back</a>
        </div>

        <div className="stub">
          <div className="header">
            <h1>{org?.name ?? "Rouxte"} — Earnings Statement</h1>
            <p>{fmtDate(stub.period_start)} – {fmtDate(stub.period_end)}</p>
          </div>

          <div className="meta">
            <div className="meta-cell">
              <div className="meta-label">Employee / Contractor</div>
              <div className="meta-value">{repProfile?.full_name ?? "—"}</div>
            </div>
            <div className="meta-cell">
              <div className="meta-label">Pay Type</div>
              <div className="meta-value" style={{ textTransform: "capitalize" }}>{stub.pay_type}</div>
            </div>
          </div>

          <div className="section">
            {/* Hours (hourly reps) */}
            {stub.pay_type === "hourly" && hoursItem && (
              <>
                <div className="section-title">Hours</div>
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Hours</th>
                      <th>Rate</th>
                      <th className="amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Regular Hours</td>
                      <td>{hoursItem.hours ?? 0}</td>
                      <td>{fmt(hoursItem.rate ?? 0)}/hr</td>
                      <td className="amount">{fmt(hoursItem.gross ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* Sales (commission reps) */}
            {saleItems.length > 0 && (
              <>
                <div className="section-title">Sales ({saleItems.length})</div>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Package</th>
                      <th>Customer</th>
                      <th>Payout</th>
                      <th>Commission %</th>
                      <th className="amount">Your Cut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.date ? fmtShort(item.date) : "—"}</td>
                        <td>{item.package ?? "—"}</td>
                        <td style={{ color: "#6b7280" }}>{item.customer_name ?? "—"}</td>
                        <td>{fmt(item.payout_amount ?? 0)}</td>
                        <td>{item.commission_pct ?? 0}%</td>
                        <td className="amount">{fmt(item.commission_amount ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Bonuses */}
            {bonusItems.length > 0 && (
              <>
                <div className="section-title">Bonuses</div>
                <table>
                  <thead>
                    <tr>
                      <th>Goal</th>
                      <th className="amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonusItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.name ?? "Bonus"}</td>
                        <td className="amount" style={{ color: "#059669" }}>{fmt(item.amount ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Chargebacks */}
            {chargebackItems.length > 0 && (
              <>
                <div className="section-title">Chargebacks</div>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reason</th>
                      <th className="amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chargebackItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.date ? fmtShort(item.date) : "—"}</td>
                        <td>{item.reason ?? "Sale reversal"}</td>
                        <td className="amount" style={{ color: "#dc2626" }}>-{fmt(item.payout_amount ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {stub.manager_notes && (
              <div style={{ marginTop: 20, padding: "12px 16px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a", fontSize: 14, color: "#92400e" }}>
                <strong>Manager Note:</strong> {stub.manager_notes}
              </div>
            )}
          </div>

          <div className="summary">
            {stub.pay_type === "commission" && (
              <div className="summary-row">
                <span>Gross Commission</span>
                <span>{fmt(stub.gross_commission)}</span>
              </div>
            )}
            {stub.pay_type === "hourly" && (
              <div className="summary-row">
                <span>Hours Pay</span>
                <span>{fmt((stub.hours_worked ?? 0) * (stub.hourly_rate ?? 0))}</span>
              </div>
            )}
            {stub.bonus > 0 && (
              <div className="summary-row" style={{ color: "#059669" }}>
                <span>Bonuses</span>
                <span>+{fmt(stub.bonus)}</span>
              </div>
            )}
            {stub.chargebacks > 0 && (
              <div className="summary-row" style={{ color: "#dc2626" }}>
                <span>Chargebacks</span>
                <span>-{fmt(stub.chargebacks)}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Net Pay</span>
              <span>{fmt(stub.net_pay)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <span className="status-badge">Released</span>
              {stub.released_at && (
                <span style={{ fontSize: 12, color: "#9ca3af" }}>
                  Paid {new Date(stub.released_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* 1099 Tax Set-Aside Notice */}
          <div style={{ maxWidth: 720, margin: "16px auto 0", padding: "16px 24px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12 }}>
            <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14, color: "#92400e" }}>⚠ 1099 Tax Set-Aside Reminder</p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#a16207", lineHeight: 1.5 }}>
              Taxes are <strong>not withheld</strong> from your pay as an independent contractor. You are responsible for paying self-employment and income taxes directly to the IRS. The IRS requires <strong>quarterly estimated payments</strong> (due Jan, Apr, Jun, Sep).
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0", color: "#92400e" }}>Self-Employment Tax (15.3%)</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#92400e" }}>{fmt(stub.net_pay * 0.153)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: "#92400e" }}>Est. Federal Income Tax (12%)</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#92400e" }}>{fmt(stub.net_pay * 0.12)}</td>
                </tr>
                <tr style={{ borderTop: "1px solid #fde68a" }}>
                  <td style={{ padding: "8px 0 4px", fontWeight: 700, color: "#78350f" }}>Suggested Set-Aside (~27%)</td>
                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: "#78350f", padding: "8px 0 4px" }}>{fmt(stub.net_pay * 0.273)}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "#b45309" }}>This is an estimate. Consult a tax professional for advice specific to your situation.</p>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          document.querySelector('.print-btn')?.addEventListener('click', () => window.print());
        `}} />
      </body>
    </html>
  );
}
