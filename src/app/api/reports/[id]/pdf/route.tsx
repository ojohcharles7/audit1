import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { getSessionUser } from "@/lib/auth/session";
import { getScope } from "@/lib/scope";
import { reportRecord } from "@/lib/reports";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 8, fontFamily: "Helvetica", color: "#334155" },
  brand: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: "#0b1b2b", paddingBottom: 10 },
  brandName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#0b1b2b" },
  small: { fontSize: 7, color: "#64748b" },
  title: { marginTop: 16, fontSize: 16, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  subtitle: { marginTop: 4, fontSize: 9, color: "#64748b" },
  summary: { flexDirection: "row", flexWrap: "wrap", marginTop: 14, gap: 6 },
  summaryCard: { width: "31%", backgroundColor: "#f8fafc", padding: 6, borderRadius: 4, marginBottom: 4 },
  summaryLabel: { fontSize: 6, color: "#94a3b8", textTransform: "uppercase" },
  summaryValue: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2, color: "#0f172a" },
  section: { marginTop: 14 },
  heading: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f172a", borderLeftWidth: 3, borderLeftColor: "#d71920", paddingLeft: 5 },
  body: { marginTop: 4, fontSize: 8, lineHeight: 1.4 },
  table: { marginTop: 4, borderWidth: 0.5, borderColor: "#e2e8f0" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" },
  headRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  cell: { flex: 1, padding: 3, fontSize: 6.5 },
  headCell: { flex: 1, padding: 3, fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#475569" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 6, color: "#94a3b8", borderTopWidth: 0.5, borderTopColor: "#e2e8f0", paddingTop: 4 },
});

function text(value: string | number) {
  return String(value).replace(/₦/g, "NGN ");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const report = reportRecord(user, getScope(user), id);
  if (!report) return new Response("Not found", { status: 404 });
  const snapshot = report.snapshot;

  const doc = (
    <Document title={snapshot.meta.title} author="Crunchies Internal Audit">
      <Page size="A4" style={styles.page}>
        <View style={styles.brand}>
          <View><Text style={styles.brandName}>Crunchies</Text><Text style={styles.small}>Internal Audit & Internal Control</Text></View>
          <View><Text style={{ fontSize: 6, color: "#dc2626" }}>{snapshot.meta.confidentiality}</Text><Text style={styles.small}>{report.report_ref}</Text></View>
        </View>
        <Text style={styles.title}>{snapshot.meta.title}</Text>
        <Text style={styles.subtitle}>{snapshot.meta.subtitle} · {snapshot.meta.period}</Text>
        <View style={styles.summary}>
          {snapshot.summary.map((item) => (
            <View key={item.label} style={styles.summaryCard}><Text style={styles.summaryLabel}>{item.label}</Text><Text style={styles.summaryValue}>{text(item.value)}</Text></View>
          ))}
        </View>
        {snapshot.sections.map((section) => (
          <View key={section.heading} style={styles.section} wrap={false}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.body ? <Text style={styles.body}>{text(section.body)}</Text> : null}
            {section.columns && section.rows ? (
              <View style={styles.table}>
                <View style={styles.headRow}>{section.columns.map((column) => <Text key={column} style={styles.headCell}>{column}</Text>)}</View>
                {section.rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.row}>{row.map((cell, cellIndex) => <Text key={cellIndex} style={styles.cell}>{text(cell)}</Text>)}</View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        <Text style={styles.footer}>Prepared by {snapshot.meta.preparedBy} · Generated {snapshot.meta.generatedAt.slice(0, 10)} · Confidential internal document</Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.report_ref}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
