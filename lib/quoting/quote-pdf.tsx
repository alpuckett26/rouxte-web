import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#0a0f1e",
  },
  brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#1BAEE1", letterSpacing: 1 },
  brandAccent: { color: "#72C41A" },
  orgName: { fontSize: 9, color: "#94a3b8", marginTop: 3 },
  headerRight: { alignItems: "flex-end" },
  quoteLabel: { fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 },
  customerName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a", marginTop: 3 },
  totalCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  totalLabel: { fontSize: 9, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  totalAmount: { fontSize: 36, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  totalSub: { fontSize: 9, color: "#93c5fd", marginTop: 4 },
  promoCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#86efac",
    padding: 14,
    marginBottom: 20,
  },
  promoLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#15803d", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  promoText: { fontSize: 11, color: "#166534" },
  section: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  rowLabel: { color: "#64748b" },
  rowValue: { color: "#1e293b", fontFamily: "Helvetica-Bold" },
  rowCredit: { color: "#16a34a", fontFamily: "Helvetica-Bold" },
  divider: { borderTopWidth: 1, borderTopColor: "#e2e8f0", marginTop: 8, marginBottom: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  totalRowLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  totalRowValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1d4ed8" },
  expectItem: { flexDirection: "row", marginBottom: 8 },
  expectDot: { width: 16, color: "#1BAEE1", fontFamily: "Helvetica-Bold" },
  expectText: { flex: 1, color: "#475569", lineHeight: 1.5 },
  repCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 16,
  },
  repLabel: { fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  repName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 3 },
  repContact: { fontSize: 10, color: "#64748b" },
  disclaimer: { fontSize: 8, color: "#94a3b8", textAlign: "center", marginTop: 8 },
});

interface FiberQuotePDFProps {
  customerName?: string;
  orgName: string;
  planLabel: string;
  planSpeed?: string;
  monthly: number;
  autopayPaperless: boolean;
  wirelessBundle: boolean;
  promoNote?: string;
  repName: string;
  repPhone?: string;
  repEmail?: string;
}

const fmt = (n: number) =>
  `$${Number(n).toFixed(2)}`;

function BrandText() {
  return (
    <View style={{ flexDirection: "row" }}>
      <Text style={[styles.brand, { color: "#1BAEE1" }]}>ROU</Text>
      <Text style={[styles.brand, { color: "#72C41A" }]}>X</Text>
      <Text style={[styles.brand, { color: "#1BAEE1" }]}>TE</Text>
    </View>
  );
}

function FiberQuotePDF({
  customerName, orgName, planLabel, planSpeed, monthly,
  autopayPaperless, wirelessBundle, promoNote,
  repName, repPhone, repEmail,
}: FiberQuotePDFProps) {
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
            <Text style={styles.quoteLabel}>AT&T Fiber Quote</Text>
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
            {autopayPaperless ? "AutoPay/Paperless applied" : "No AutoPay discount"}
            {wirelessBundle ? "  ·  Wireless bundle discount applied" : ""}
          </Text>
        </View>

        {/* Promo note */}
        {promoNote ? (
          <View style={styles.promoCard}>
            <Text style={styles.promoLabel}>Current Promotion</Text>
            <Text style={styles.promoText}>{promoNote}</Text>
          </View>
        ) : null}

        {/* Plan details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Details</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Internet Plan</Text>
            <Text style={styles.rowValue}>{planLabel}</Text>
          </View>
          {planSpeed ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Speed</Text>
              <Text style={styles.rowValue}>{planSpeed}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>AutoPay & Paperless</Text>
            <Text style={styles.rowValue}>{autopayPaperless ? "Yes (−5/mo)" : "No"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Wireless Bundle Discount</Text>
            <Text style={styles.rowValue}>{wirelessBundle ? "Yes (−20%)" : "No"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Activation Fee</Text>
            <Text style={styles.rowValue}>$0.00</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Equipment Fee</Text>
            <Text style={styles.rowValue}>$0.00 (gateway included)</Text>
          </View>
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
            <Text style={styles.expectText}>Your first bill will include a full month + a partial month based on your install date.</Text>
          </View>
          <View style={styles.expectItem}>
            <Text style={styles.expectDot}>{"•"}</Text>
            <Text style={styles.expectText}>AT&T will schedule a professional installation — no DIY required.</Text>
          </View>
          <View style={styles.expectItem}>
            <Text style={styles.expectDot}>{"•"}</Text>
            <Text style={styles.expectText}>Your Wi-Fi gateway is included at no additional cost.</Text>
          </View>
          <View style={styles.expectItem}>
            <Text style={styles.expectDot}>{"•"}</Text>
            <Text style={styles.expectText}>No activation fee and no annual contract required.</Text>
          </View>
          {wirelessBundle ? (
            <View style={styles.expectItem}>
              <Text style={styles.expectDot}>{"•"}</Text>
              <Text style={styles.expectText}>Your wireless bundle discount will appear within 1–2 billing cycles after both services are active.</Text>
            </View>
          ) : null}
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

export async function renderFiberQuotePDF(props: FiberQuotePDFProps): Promise<Buffer> {
  return renderToBuffer(<FiberQuotePDF {...props} />) as Promise<Buffer>;
}
