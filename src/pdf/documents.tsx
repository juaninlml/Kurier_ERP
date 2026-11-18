import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { Client, CompanySettings, Invoice, InvoiceItem, Payment, Quote, QuoteItem } from "@prisma/client";
import { BrandedPage, PartyBox, ItemsTable, TotalsBlock, TextSection, PdfDoc, base, tint } from "./brand";
import { formatDate, formatMoney, round2 } from "@/lib/money";
import type { incomeStatement, receivables } from "@/lib/reports";
import { STATUS_LABELS } from "@/lib/constants";

const clientLines = (c: Client) => [
  c.legalName && c.legalName !== c.name ? c.legalName : null,
  c.rfc ? `RFC: ${c.rfc}` : null,
  c.address,
  [c.contactName, c.email, c.phone].filter(Boolean).join(" · "),
];

export function QuotePdf({ s, quote }: { s: CompanySettings; quote: Quote & { client: Client; items: QuoteItem[] } }) {
  return (
    <PdfDoc title={`Cotización ${quote.folio}`}>
      <BrandedPage
        s={s}
        title="COTIZACIÓN"
        folio={quote.folio}
        meta={[
          { label: "Fecha", value: formatDate(quote.issueDate) },
          { label: "Vigente hasta", value: formatDate(quote.validUntil) },
          { label: "Moneda", value: "MXN" },
        ]}
        watermark={quote.status === "RECHAZADA" ? "RECHAZADA" : undefined}
      >
        <PartyBox s={s} title="Cotización para" name={quote.client.name} lines={clientLines(quote.client)} />
        <ItemsTable s={s} items={quote.items} />
        <TotalsBlock s={s} subtotal={quote.subtotal} discount={quote.discount} tax={quote.tax} total={quote.total} />
        <TextSection s={s} title="Notas" text={quote.notes} />
        <TextSection s={s} title="Términos y condiciones" text={quote.terms} />
        <View wrap={false} style={{ marginTop: 28, flexDirection: "row", justifyContent: "space-around" }}>
          {["Elaboró", "Aceptación del cliente"].map((l) => (
            <View key={l} style={{ width: "38%", alignItems: "center" }}>
              <View style={{ borderTopWidth: 1, borderTopColor: "#94a3b8", width: "100%", marginBottom: 4 }} />
              <Text style={base.muted}>{l}</Text>
            </View>
          ))}
        </View>
      </BrandedPage>
    </PdfDoc>
  );
}

export function InvoicePdf({
  s,
  invoice,
}: {
  s: CompanySettings;
  invoice: Invoice & { client: Client; items: InvoiceItem[]; payments: Payment[]; quote: Quote | null };
}) {
  const balance = round2(invoice.total - invoice.paidTotal);
  const extra = invoice.paidTotal > 0
    ? [
        { label: "Pagado", value: formatMoney(invoice.paidTotal) },
        { label: "Saldo pendiente", value: formatMoney(balance), strong: true },
      ]
    : undefined;
  const meta = [
    { label: "Fecha de emisión", value: formatDate(invoice.issueDate) },
    { label: "Vencimiento", value: formatDate(invoice.dueDate) },
    { label: "Estatus", value: STATUS_LABELS[invoice.status] ?? invoice.status },
  ];
  if (invoice.quote) meta.push({ label: "Cotización", value: invoice.quote.folio });

  const bank = [
    s.bankName && `Banco: ${s.bankName}`,
    s.bankAccount && `Cuenta: ${s.bankAccount}`,
    s.clabe && `CLABE: ${s.clabe}`,
    s.legalName && `Beneficiario: ${s.legalName}`,
  ].filter(Boolean) as string[];

  return (
    <PdfDoc title={`Factura ${invoice.folio}`}>
      <BrandedPage
        s={s}
        title="FACTURA"
        folio={invoice.folio}
        meta={meta}
        watermark={invoice.status === "CANCELADA" ? "CANCELADA" : invoice.status === "PAGADA" ? "PAGADA" : undefined}
      >
        <PartyBox s={s} title="Facturar a" name={invoice.client.name} lines={clientLines(invoice.client)} />
        <ItemsTable s={s} items={invoice.items} />
        <TotalsBlock s={s} subtotal={invoice.subtotal} discount={invoice.discount} tax={invoice.tax} total={invoice.total} extra={extra} />

        {invoice.payments.length > 0 && (
          <View wrap={false} style={{ marginBottom: 12 }}>
            <Text style={[base.sectionTitle, { color: s.primaryColor }]}>Pagos recibidos</Text>
            {invoice.payments.map((p) => (
              <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" }}>
                <Text>
                  {formatDate(p.date)} · {p.method}
                  {p.reference ? ` · Ref. ${p.reference}` : ""}
                </Text>
                <Text style={base.bold}>{formatMoney(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {bank.length > 0 && (
          <View wrap={false} style={[base.box, { borderWidth: 1, borderColor: tint(s.primaryColor, 0.8), marginBottom: 12 }]}>
            <Text style={[base.sectionTitle, { color: s.primaryColor }]}>Datos para pago</Text>
            {bank.map((b) => (
              <Text key={b}>{b}</Text>
            ))}
            <Text style={[base.muted, { marginTop: 3 }]}>Referencia: {invoice.folio}</Text>
          </View>
        )}
        <TextSection s={s} title="Notas" text={invoice.notes} />
      </BrandedPage>
    </PdfDoc>
  );
}

type Statement = {
  client: Client;
  invoices: (Invoice & { payments: Payment[] })[];
};

export function StatementPdf({ s, data }: { s: CompanySettings; data: Statement }) {
  const open = data.invoices.filter((i) => i.status === "PENDIENTE" || i.status === "PARCIAL");
  const balance = round2(open.reduce((a, i) => a + i.total - i.paidTotal, 0));
  const now = new Date();
  const overdue = round2(open.filter((i) => i.dueDate < now).reduce((a, i) => a + i.total - i.paidTotal, 0));
  const cell = { paddingVertical: 5, paddingHorizontal: 4 } as const;
  const th = { color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 8 } as const;
  const w = ["16%", "14%", "14%", "14%", "14%", "14%", "14%"];

  return (
    <PdfDoc title={`Estado de cuenta ${data.client.name}`}>
      <BrandedPage
        s={s}
        title="ESTADO DE CUENTA"
        meta={[
          { label: "Fecha de corte", value: formatDate(now) },
          { label: "Facturas abiertas", value: String(open.length) },
        ]}
      >
        <PartyBox s={s} title="Cliente" name={data.client.name} lines={clientLines(data.client)} />

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {[
            { l: "Saldo total", v: formatMoney(balance), c: s.primaryColor },
            { l: "Vencido", v: formatMoney(overdue), c: "#b91c1c" },
            { l: "Por vencer", v: formatMoney(round2(balance - overdue)), c: "#047857" },
          ].map((k) => (
            <View key={k.l} style={[base.box, { flex: 1, backgroundColor: tint(s.primaryColor, 0.94) }]}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{k.l.toUpperCase()}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: k.c, marginTop: 2 }}>{k.v}</Text>
            </View>
          ))}
        </View>

        <View fixed style={{ flexDirection: "row", backgroundColor: s.primaryColor, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
          {["FOLIO", "EMISIÓN", "VENCE", "ESTATUS", "TOTAL", "PAGADO", "SALDO"].map((h, i) => (
            <Text key={h} style={[th, cell, { width: w[i], textAlign: i >= 4 ? "right" : "left" }]}>
              {h}
            </Text>
          ))}
        </View>
        {data.invoices.map((inv, idx) => {
          const bal = round2(inv.status === "CANCELADA" ? 0 : inv.total - inv.paidTotal);
          const late = bal > 0 && inv.dueDate < now;
          return (
            <View key={inv.id} wrap={false} style={{ flexDirection: "row", backgroundColor: idx % 2 ? tint(s.primaryColor, 0.95) : "#fff", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" }}>
              <Text style={[cell, { width: w[0], fontFamily: "Helvetica-Bold" }]}>{inv.folio}</Text>
              <Text style={[cell, { width: w[1] }]}>{formatDate(inv.issueDate)}</Text>
              <Text style={[cell, { width: w[2], color: late ? "#b91c1c" : undefined }]}>{formatDate(inv.dueDate)}</Text>
              <Text style={[cell, { width: w[3] }]}>{late ? "Vencida" : STATUS_LABELS[inv.status]}</Text>
              <Text style={[cell, { width: w[4], textAlign: "right" }]}>{formatMoney(inv.total)}</Text>
              <Text style={[cell, { width: w[5], textAlign: "right" }]}>{formatMoney(inv.paidTotal)}</Text>
              <Text style={[cell, { width: w[6], textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{formatMoney(bal)}</Text>
            </View>
          );
        })}
        {data.invoices.length === 0 && <Text style={[base.muted, { padding: 10 }]}>Sin facturas registradas.</Text>}
      </BrandedPage>
    </PdfDoc>
  );
}

export function ReportPdf({
  s,
  from,
  to,
  stmt,
  ar,
}: {
  s: CompanySettings;
  from: Date;
  to: Date;
  stmt: Awaited<ReturnType<typeof incomeStatement>>;
  ar: Awaited<ReturnType<typeof receivables>>;
}) {
  const row = { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" } as const;
  const header = (label: string) => (
    <View style={{ backgroundColor: s.primaryColor, paddingVertical: 5, paddingHorizontal: 6, borderRadius: 3, marginTop: 6 }}>
      <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 9 }}>{label}</Text>
    </View>
  );
  const totalRow = (label: string, value: number, color?: string) => (
    <View style={[row, { backgroundColor: tint(s.primaryColor, 0.92), borderBottomWidth: 0 }]}>
      <Text style={base.bold}>{label}</Text>
      <Text style={[base.bold, color ? { color } : {}]}>{formatMoney(value)}</Text>
    </View>
  );

  return (
    <PdfDoc title="Reporte financiero">
      <BrandedPage
        s={s}
        title="REPORTE FINANCIERO"
        meta={[
          { label: "Desde", value: formatDate(from) },
          { label: "Hasta", value: formatDate(to) },
          { label: "Movimientos", value: String(stmt.count) },
        ]}
      >
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {[
            { l: "Ingresos", v: stmt.incomeTotal, c: "#047857" },
            { l: "Egresos", v: stmt.expenseTotal, c: "#b91c1c" },
            { l: "Flujo neto", v: stmt.cashFlow, c: stmt.cashFlow >= 0 ? s.primaryColor : "#b91c1c" },
            { l: "Por cobrar", v: ar.total, c: s.accentColor },
          ].map((k) => (
            <View key={k.l} style={[base.box, { flex: 1, backgroundColor: tint(s.primaryColor, 0.94) }]}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{k.l.toUpperCase()}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: k.c, marginTop: 2 }}>{formatMoney(k.v)}</Text>
            </View>
          ))}
        </View>

        <Text style={[base.sectionTitle, { color: s.primaryColor, fontSize: 10 }]}>Estado de resultados (flujo)</Text>
        {header("INGRESOS")}
        {stmt.income.map((r) => (
          <View key={r.category} style={row}>
            <Text>
              {r.category} <Text style={base.muted}>({r.count})</Text>
            </Text>
            <Text>{formatMoney(r.amount)}</Text>
          </View>
        ))}
        {stmt.income.length === 0 && <Text style={[base.muted, { padding: 6 }]}>Sin ingresos en el periodo.</Text>}
        {totalRow("Total ingresos", stmt.incomeTotal, "#047857")}

        {header("EGRESOS")}
        {stmt.expense.map((r) => (
          <View key={r.category} style={row}>
            <Text>
              {r.category} <Text style={base.muted}>({r.count})</Text>
            </Text>
            <Text>{formatMoney(r.amount)}</Text>
          </View>
        ))}
        {stmt.expense.length === 0 && <Text style={[base.muted, { padding: 6 }]}>Sin egresos en el periodo.</Text>}
        {totalRow("Total egresos", stmt.expenseTotal, "#b91c1c")}

        <View style={{ marginTop: 10 }} wrap={false}>
          {totalRow("Flujo neto (con IVA)", stmt.cashFlow)}
          <View style={row}>
            <Text style={base.muted}>IVA cobrado (en ingresos)</Text>
            <Text>{formatMoney(stmt.incomeTax)}</Text>
          </View>
          <View style={row}>
            <Text style={base.muted}>IVA pagado (en egresos)</Text>
            <Text>{formatMoney(stmt.expenseTax)}</Text>
          </View>
          <View style={row}>
            <Text style={base.muted}>Diferencia de IVA (estimado)</Text>
            <Text>{formatMoney(stmt.ivaBalance)}</Text>
          </View>
          {totalRow("Utilidad antes de impuestos (sin IVA)", stmt.netBeforeTax, stmt.netBeforeTax >= 0 ? "#047857" : "#b91c1c")}
        </View>

        <View style={{ marginTop: 16 }} wrap={false}>
          <Text style={[base.sectionTitle, { color: s.primaryColor, fontSize: 10 }]}>Antigüedad de cuentas por cobrar</Text>
          <View style={{ flexDirection: "row", marginTop: 4 }}>
            {(Object.entries(ar.byBucket) as [string, number][]).map(([b, v]) => (
              <View key={b} style={{ flex: 1, padding: 6, borderWidth: 0.5, borderColor: tint(s.primaryColor, 0.8) }}>
                <Text style={[base.muted, { fontSize: 7.5 }]}>{b === "corriente" ? "AL CORRIENTE" : `${b} DÍAS`}</Text>
                <Text style={[base.bold, { marginTop: 2 }]}>{formatMoney(v)}</Text>
              </View>
            ))}
          </View>
        </View>

        {ar.rows.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {ar.rows.slice(0, 40).map((r) => (
              <View key={r.id} style={row} wrap={false}>
                <Text style={{ width: "18%", fontFamily: "Helvetica-Bold" }}>{r.folio}</Text>
                <Text style={{ width: "42%" }}>{r.client.name}</Text>
                <Text style={{ width: "20%", color: r.daysOverdue > 0 ? "#b91c1c" : "#64748b" }}>
                  {r.daysOverdue > 0 ? `${r.daysOverdue} días vencida` : `Vence ${formatDate(r.dueDate)}`}
                </Text>
                <Text style={{ width: "20%", textAlign: "right" }}>{formatMoney(r.balance)}</Text>
              </View>
            ))}
          </View>
        )}
      </BrandedPage>
    </PdfDoc>
  );
}
