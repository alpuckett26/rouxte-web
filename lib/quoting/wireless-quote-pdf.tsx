import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const WIRELESS_PLAN_LABELS: Record<string, string> = {
  premium:            "Premium Unlimited",
  extra:              "Extra (50GB)",
  starter:            "Starter",
  firstnet_unlimited: "FirstNet Unlimited",
  firstnet_extra:     "FirstNet Extra",
  senior_55plus:      "55+ Plan",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#0a0f1e",
  },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  orgName: { fontSize: 9, color: "#94a3b8", marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  quoteLabel: { fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 },
  customerName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a", marginTop: 3 },
  totalCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: { fontSize: 9, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  totalAmount: { fontSize: 32, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  totalSub: { fontSize: 9, color: "#93c5fd", marginTop: 3 },
  section: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 10 },
  lineCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  lineHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  lineNum: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  linePlan: { fontSize: 9, color: "#64748b", marginTop: 2 },
  lineTotal: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  rowLabel: { color: "#64748b" },
  rowValue: { color: "#1e293b", fontFamily: "Helvetica-Bold" },
  rowCredit: { color: "#16a34a", fontFamily: "Helvetica-Bold" },
  divider: { borderTopWidth: 1, borderTopColor: "#e2e8f0", marginTop: 6, marginBottom: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalRowLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  totalRowValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  expectItem: { flexDirection: "row", marginBottom: 6 },
  expectDot: { width: 14, color: "#1BAEE1", fontFamily: "Helvetica-Bold" },
  expectText: { flex: 1, color: "#475569", lineHeight: 1.5 },
  repCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 12,
  },
  repLabel: { fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  repName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 2 },
  repContact: { fontSize: 10, color: "#64748b" },
  disclaimer: { fontSize: 8, color: "#94a3b8", textAlign: "center", marginTop: 6 },
});

export interface WirelessQuoteLine {
  line_number: number;
  plan_type: string;
  rate_plan: number;
  plan_promo: number;
  next_up: boolean;
  next_up_amt: number;
  insurance: number;
  retailer_promo: number;
  device: number;
  device_promo: number;
  line_total: number;
}

export interface WirelessQuotePDFProps {
  customerName?: string;
  orgName: string;
  monthly: number;
  totalLines: number;
  autopayPaperless: boolean;
  discountType: string;
  lines: WirelessQuoteLine[];
  activationFee: number;
  repName: string;
  repPhone?: string;
  repEmail?: string;
}

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

function BrandText() {
  return (
    <View style={{ flexDirection: "row" }}>
      <Text style={[styles.brand, { color: "#1BAEE1" }]}>ROU</Text>
      <Text style={[styles.brand, { color: "#72C41A" }]}>X</Text>
      <Text style={[styles.brand, { color: "#1BAEE1" }]}>TE</Text>
    </View>
  );
}

function WirelessQuotePDF({
  customerName, orgName, monthly, totalLines, autopayPaperless,
  discountType, lines, activationFee, repName, repPhone, repEmail,
}: WirelessQuotePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <BrandText />
            <Text style={styles.orgName}>{orgName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.quoteLabel}>AT&T Wireless Quote</Text>
            {customerName ? (
              <Text style={styles.customerName}>{customerName}</Text>
            ) : null}
          </View>
        </View>

        {/* Monthly total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Estimated Monthly Total</Text>
          <Text style={styles.totalAmount}>{fmt(monthly)}</Text>
          <Text style={styles.totalSub}>
            {totalLines} line{totalLines !== 1 ? "s" : ""}
            {"  ·  "}
            {autopayPaperless ? "AutoPay/Paperless applied" : "No AutoPay discount"}
            {discountType !== "none" ? `  ·  ${discountType} discount` : ""}
          </Text>
        </View>

        {/* Per-line breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Breakdown</Text>

          {lines.map(line => (
            <View key={line.line_number} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                <View>
                  <Text style={styles.lineNum}>Line {line.line_number}</Text>
                  <Text style={styles.linePlan}>
                    {WIRELESS_PLAN_LABELS[line.plan_type] ?? line.plan_type}
                  </Text>
                </View>
                <Text style={styles.lineTotal}>{fmt(line.line_total)}/mo</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Rate Plan</Text>
                <Text style={styles.rowValue}>{fmt(line.rate_plan)}</Text>
              </View>
              {line.plan_promo > 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Plan Promo</Text>
                  <Text style={styles.rowCredit}>−{fmt(line.plan_promo)}</Text>
                </View>
              )}
              {line.next_up && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Next Up</Text>
                  <Text style={styles.rowValue}>+{fmt(line.next_up_amt)}</Text>
                </View>
              )}
              {line.insurance > 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Insurance</Text>
                  <Text style={styles.rowValue}>{fmt(line.insurance)}</Text>
                </View>
              )}
              {line.retailer_promo > 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Retailer Promo</Text>
                  <Text style={styles.rowCredit}>−{fmt(line.retailer_promo)}</Text>
                </View>
              )}
              {line.device > 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Device</Text>
                  <Text style={styles.rowValue}>{fmt(line.device)}</Text>
                </View>
              )}
              {line.device_promo > 0 && (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Device Promo</Text>
                  <Text style={styles.rowCredit}>−{fmt(line.device_promo)}</Text>
                </View>
              )}
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Monthly Total</Text>
            <Text style={styles.totalRowValue}>{fmt(monthly)}</Text>
          </View>
        </View>

        {/* What to expect */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to Expect</Text>
          <View style={styles.expectItem}>
            <Text style={styles.expectDot}>{"•"}</Text>
            <Text style={styles.expectText}>Your first bill will include a full month + a partial month based on your activation date.</Text>
          </View>
          <View style={styles.expectItem}>
            <Text style={styles.expectDot}>{"•"}</Text>
            <Text style={styles.expectText}>Promotions begin applying within 2–3 billing cycles after all required steps are complete.</Text>
          </View>
          <View style={styles.expectItem}>
            <Text style={styles.expectDot}>{"•"}</Text>
            <Text style={styles.expectText}>Plan promotions require registration at att.com/signature once phones arrive.</Text>
          </View>
          <View style={styles.expectItem}>
            <Text style={styles.expectDot}>{"•"}</Text>
            <Text style={styles.expectText}>Trade-in devices must be returned within 30 days of activation.</Text>
          </View>
          {activationFee > 0 && (
            <View style={styles.expectItem}>
              <Text style={styles.expectDot}>{"•"}</Text>
              <Text style={styles.expectText}>An activation fee of {fmt(activationFee)} will appear on your first bill.</Text>
            </View>
          )}
        </View>

        {/* Rep contact */}
        {(repPhone || repEmail) ? (
          <View style={styles.repCard}>
            <Text style={styles.repLabel}>Your Rep</Text>
            <Text style={styles.repName}>{repName}</Text>
            <Text style={styles.repContact}>
              {[repPhone, repEmail].filter(Boolean).join("  ·  ")}
            </Text>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          Pricing, plans, and promotions subject to change. Quote generated via Rouxte.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderWirelessQuotePDF(props: WirelessQuotePDFProps): Promise<Buffer> {
  return renderToBuffer(<WirelessQuotePDF {...props} />) as Promise<Buffer>;
}
