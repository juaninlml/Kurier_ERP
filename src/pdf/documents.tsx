import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { Client, CompanySettings, Invoice, InvoiceItem, Payment, Quote, QuoteItem, Service, ServiceSection, TariffTable } from "@prisma/client";
import { BrandedPage, DocTitle, SectionTab, Table, Note, Conditions, PdfDoc, Callout, InfoTable, parseInfoTable, base, palette, tint } from "./brand";
import { CleanPage, PartyBlock, InfoGrid, SectionLabel, CleanTable, TotalsBox, SmallNote, CompactTerms, C, type CleanCell, type CleanCol } from "./clean";
import { parsePerOrder, parseVolumes, scenarioTable } from "@/lib/quote-extras";
import { quoteParty } from "@/lib/quote-party";
import { formatDateEs, formatDateLongEs, formatDateNum, formatDateNumEs, formatMoney, formatNumber, amountInWords, amountInWordsEn, round2 } from "@/lib/money";
import { docText } from "@/lib/i18n/doc-text";
import { groupBySection, rateLabel } from "@/lib/totals";
import type { incomeStatement, receivables } from "@/lib/reports";
import { STATUS_LABELS } from "@/lib/constants";

const PRICES_NOTE = "Todos los precios sin IVA, en pesos mexicanos (MXN)";
const qtyLabel = (q: number, unit: string) => `${formatNumber(q)} ${unit.toLowerCase()}`;
const taxLabel = (items: { taxRate: number }[]) => {
  const rates = [...new Set(items.filter((i) => i.taxRate > 0).map((i) => i.taxRate))];
  return rates.length === 1 ? `IVA ${formatNumber(rates[0])}%` : "IVA";
};

// ───────────────────────────── Cotización ─────────────────────────────

export function QuotePdf({
  s,
  quote,
  sectionNotes,
  infoTables = [],
}: {
  s: CompanySettings;
  quote: Quote & { client: Client | null; items: QuoteItem[] };
  sectionNotes: Record<string, string>;
  /** Tablas informativas del tarifario marcadas para imprimirse en cotizaciones (SLA, etc.). */
  infoTables?: TariffTable[];
}) {
  const profile: { label: string; value: string }[] = (() => {
    try {
      return JSON.parse(quote.profile);
    } catch {
      return [];
    }
  })();
  const party = quoteParty(quote);
  const groups = groupBySection(quote.items);
  const estimate = quote.items.filter((i) => i.quantity > 0 && i.amount > 0);
  const perOrder = parsePerOrder(quote.perOrder);
  const volumes = parseVolumes(quote.scenarios);
  const scenarios = scenarioTable(quote.items, quote.baseVolume, volumes, formatMoney);
  const tax = taxLabel(quote.items);

  // Servicios: una sola tabla; cada sección es un subtítulo dentro de ella.
  const svcRows: CleanCell[][] = [];
  const svcGroups: Record<number, string> = {};
  const svcNotes = groups.map(([section]) => sectionNotes[section]).filter((n) => n?.trim());
  for (const [section, items] of groups) {
    if (groups.length > 1 || section) svcGroups[svcRows.length] = section || "Otros servicios";
    for (const i of items) svcRows.push([{ main: i.description, bold: true }, { main: rateLabel(i, formatMoney), color: s.accentColor, bold: true }, i.detail]);
  }

  return (
    <PdfDoc title={`Cotización ${quote.folio} — ${party.name}`}>
      <CleanPage s={s} title={`Cotización ${quote.folio}`} watermark={quote.status === "RECHAZADA" ? "RECHAZADA" : undefined}>
        <PartyBlock
          name={party.legalName || party.name}
          lines={[party.legalName && party.legalName !== party.name ? party.name : "", party.rfc && `RFC: ${party.rfc}`, quote.attention && `Atención: ${quote.attention}`]}
        />

        <InfoGrid
          items={[
            { label: "Fecha", value: formatDateNumEs(quote.issueDate) },
            { label: "Vigente hasta", value: formatDateNumEs(quote.validUntil) },
            ...profile.filter((r) => r.label.trim() && r.value.trim()),
          ]}
        />

        {svcRows.length > 0 && (
          <CleanTable
            cols={[
              { title: "Servicio", width: "27%" },
              { title: "Tarifa", width: "20%" },
              { title: "Descripción", width: "53%" },
            ]}
            rows={svcRows}
            groups={svcGroups}
          />
        )}
        {svcNotes.map((n) => (
          <SmallNote key={n} text={n} />
        ))}

        {perOrder.length > 0 && (
          <View wrap={false}>
            <SectionLabel s={s}>Costo por pedido</SectionLabel>
            <CleanTable
              cols={
                quote.perOrderFee > 0
                  ? [
                      { title: "Tipo de pedido", width: "58%" },
                      { title: "Fulfillment", width: "20%", align: "right" },
                      { title: "Con guía de Kurier", width: "22%", align: "right" },
                    ]
                  : [
                      { title: "Tipo de pedido", width: "75%" },
                      { title: "Fulfillment", width: "25%", align: "right" },
                    ]
              }
              rows={perOrder.map((r) =>
                quote.perOrderFee > 0
                  ? [r.label, formatMoney(r.amount), { main: formatMoney(round2(r.amount + quote.perOrderFee)), bold: true }]
                  : [r.label, { main: formatMoney(r.amount), bold: true }],
              )}
            />
            <SmallNote
              text={
                quote.perOrderFee > 0
                  ? `Precios sin IVA. La columna "Con guía de Kurier" suma la comisión de ${formatMoney(quote.perOrderFee)} por guía; no incluye el flete.`
                  : "Precios sin IVA."
              }
            />
          </View>
        )}

        {scenarios && (
          <View wrap={scenarios.rows.length > 12}>
            <SectionLabel s={s}>Costo mensual según volumen</SectionLabel>
            <CleanTable
              cols={scenarioCols(volumes)}
              rows={[
                ...scenarios.rows.map((r) => [r.label, ...r.values.map((v) => formatMoney(v))]),
                ["Subtotal sin IVA", ...scenarios.subtotal.map((v) => formatMoney(v))].map((v) => ({ main: v, bold: true })),
                [tax, ...scenarios.tax.map((v) => formatMoney(v))],
                ["Total mensual estimado", ...scenarios.total.map((v) => formatMoney(v))].map((v) => ({ main: v, bold: true, color: s.accentColor })),
              ]}
            />
            <SmallNote text={quote.notes} />
          </View>
        )}

        {!scenarios && estimate.length > 0 && (
          <View wrap={estimate.length > 12}>
            <SectionLabel s={s}>Costo mensual estimado</SectionLabel>
            <CleanTable
              cols={[
                { title: "Concepto", width: "52%" },
                { title: "Cantidad", width: "16%", align: "right" },
                { title: "Tarifa", width: "15%", align: "right" },
                { title: "Importe", width: "17%", align: "right" },
              ]}
              rows={estimate.map((i) => [i.description, qtyLabel(i.quantity, i.unit), i.atCost ? "Al costo" : formatMoney(i.unitPrice), formatMoney(i.amount)])}
            />
            <View wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
              <View style={{ flex: 1, paddingRight: 24 }}>
                <SmallNote text={quote.notes} style={{ marginTop: 0 }} />
              </View>
              <TotalsBox
                s={s}
                rows={[
                  { label: "Subtotal sin IVA", value: formatMoney(quote.subtotal - quote.discount) },
                  ...(quote.discount > 0 ? [{ label: "Descuento incluido", value: formatMoney(-quote.discount) }] : []),
                  { label: tax, value: formatMoney(quote.tax) },
                ]}
                total={{ label: "Total mensual estimado", value: formatMoney(quote.total) }}
              />
            </View>
          </View>
        )}
        {!scenarios && estimate.length === 0 && <SmallNote text={quote.notes} />}

        {infoTables.map((t) => {
          const p = parseInfoTable(t.columns, t.rows);
          if (!p) return null;
          return (
            <View key={t.id} wrap={p.data.length > 10}>
              <SectionLabel s={s}>{t.title}</SectionLabel>
              <CleanTable cols={p.cols} rows={p.data.map((r) => r.map((v, j): CleanCell => (j === 0 ? { main: v, bold: true } : p.isRate ? { main: v, color: s.accentColor, bold: true } : v)))} />
              <SmallNote text={t.note} />
            </View>
          );
        })}

        {quote.terms.trim() && (
          <View>
            <SectionLabel s={s}>Condiciones comerciales</SectionLabel>
            <CompactTerms text={quote.terms} />
          </View>
        )}
        <SmallNote text={`${PRICES_NOTE}.`} style={{ marginTop: 10 }} />
      </CleanPage>
    </PdfDoc>
  );
}

/** Columnas de la tabla de escenarios por volumen. */
function scenarioCols(volumes: number[]): CleanCol[] {
  const w = volumes.length <= 3 ? 17 : 14;
  return [
    { title: "Concepto", width: `${100 - w * volumes.length}%` },
    ...volumes.map((v) => ({ title: `${formatNumber(v)} pedidos`, width: `${w}%`, align: "right" as const })),
  ];
}

// ───────────────────────────── Factura ─────────────────────────────

/** Textos fijos del formato de factura (el contenido capturado se respeta; algunos conceptos comunes se traducen). */
const INVOICE_L = {
  es: {
    doc: "Factura", subtitle: `Formato de facturación · ${PRICES_NOTE}`, footer: "Formato de Factura",
    folio: "Folio", folioNote: "folio interno de referencia", issue: "Fecha de emisión", due: "Fecha de vencimiento", client: "Cliente", rfc: "RFC",
    period: "Periodo facturado", volume: "Volumen del periodo", storage: "Almacenamiento", terms: "Condiciones de pago", quote: "Cotización de referencia",
    billing: "Datos de facturación", detail: "Detalle de servicios facturados", concept: "Concepto", qty: "Cantidad", unitPrice: "Precio unitario", amount: "Importe",
    atCost: "Variable (al costo)", subtotal: "Subtotal sin IVA", discount: "Descuento", tax: "IVA", paid: "Pagado", balance: "Saldo pendiente", total: "Total a pagar",
    taxes: "Impuestos", exempt: "Exento", totalInv: "Total factura", words: "Importe con letra:",
    payments: "Pagos recibidos", ref: "Ref.", payData: "Datos para pago", bank: "Banco", account: "Cuenta", clabe: "CLABE", beneficiary: "Beneficiario", reference: "Referencia de pago",
    cancelled: "CANCELADA", paidMark: "PAGADA",
  },
  en: {
    doc: "Invoice", subtitle: "Billing format · All prices exclude VAT, in Mexican pesos (MXN)", footer: "Invoice format",
    folio: "Invoice no.", folioNote: "internal reference number", issue: "Issue date", due: "Due date", client: "Client", rfc: "Tax ID (RFC)",
    period: "Billing period", volume: "Period volume", storage: "Storage", terms: "Payment terms", quote: "Reference quote",
    billing: "Billing details", detail: "Services billed", concept: "Description", qty: "Quantity", unitPrice: "Unit price", amount: "Amount",
    atCost: "Variable (at cost)", subtotal: "Subtotal before VAT", discount: "Discount", tax: "VAT", paid: "Paid", balance: "Balance due", total: "Total due",
    taxes: "Taxes", exempt: "Exempt", totalInv: "Invoice total", words: "Total amount in words:",
    payments: "Payments received", ref: "Ref.", payData: "Payment details", bank: "Bank", account: "Account", clabe: "CLABE", beneficiary: "Beneficiary", reference: "Payment reference",
    cancelled: "CANCELLED", paidMark: "PAID",
  },
} as const;

/** Plural simple en inglés para unidades ("package" → "packages"); las que ya terminan en s o llevan "/" se dejan. */
const pluralEn = (unit: string, qty: number) => (qty === 1 || !unit || /s$|\/|\s/.test(unit) ? unit : unit.endsWith("x") ? `${unit}es` : `${unit}s`);

export function InvoicePdf({
  s,
  invoice,
  lang = "es",
}: {
  s: CompanySettings;
  invoice: Invoice & { client: Client; items: InvoiceItem[]; payments: Payment[]; quote: Quote | null };
  /** Idioma del formato: los textos fijos y los conceptos comunes se traducen. */
  lang?: "es" | "en";
}) {
  const L = INVOICE_L[lang];
  const en = lang === "en";
  const x = (text: string) => docText(text, lang);
  const date = (d: Date) => (en ? formatDateNum(d, "en-US") : formatDateNumEs(d));
  const balance = round2(invoice.total - invoice.paidTotal);
  const cl = invoice.client;

  const rates = [...new Set(invoice.items.filter((i) => i.taxRate > 0).map((i) => i.taxRate))];
  const totalsRows: { label: string; value: string }[] = [{ label: L.subtotal, value: formatMoney(invoice.subtotal) }];
  if (invoice.discount > 0) totalsRows.push({ label: L.discount, value: `-${formatMoney(invoice.discount)}` });
  totalsRows.push({ label: rates.length === 1 ? `${L.tax} ${formatNumber(rates[0])}%` : L.tax, value: formatMoney(invoice.tax) });
  if (invoice.paidTotal > 0) {
    totalsRows.push({ label: L.totalInv, value: formatMoney(invoice.total) });
    totalsRows.push({ label: L.paid, value: `-${formatMoney(invoice.paidTotal)}` });
  }
  const due = invoice.paidTotal > 0 ? balance : invoice.total;

  const bank: [string, string][] = (
    [
      [L.bank, s.bankName],
      [L.account, s.bankAccount],
      [L.clabe, s.clabe],
      [L.beneficiary, s.legalName],
    ] as [string, string][]
  ).filter(([, v]) => v);

  return (
    <PdfDoc title={`${L.doc} ${invoice.folio} — ${cl.name}`}>
      <CleanPage s={s} lang={lang} title={`${L.doc} ${invoice.folio}`} watermark={invoice.status === "CANCELADA" ? L.cancelled : invoice.status === "PAGADA" ? L.paidMark : undefined}>
        <PartyBlock name={cl.legalName || cl.name} lines={[cl.legalName && cl.legalName !== cl.name ? cl.name : "", cl.rfc && `${L.rfc}: ${cl.rfc}`, cl.address]} />

        <InfoGrid
          items={[
            { label: L.issue, value: date(invoice.issueDate) },
            { label: L.due, value: date(invoice.dueDate) },
            { label: L.period, value: x(invoice.period) },
            { label: L.quote, value: invoice.quote?.folio ?? "" },
            { label: L.volume, value: x(invoice.volume) },
            { label: L.storage, value: docText(invoice.storage, lang, "storage") },
          ]}
        />

        <CleanTable
          cols={[
            { title: L.concept, width: "40%" },
            { title: L.qty, width: "17%", align: "right" },
            { title: L.unitPrice, width: "16%", align: "right" },
            { title: L.taxes, width: "11%", align: "right" },
            { title: L.amount, width: "16%", align: "right" },
          ]}
          rows={invoice.items.map((i) => [
            { main: x(i.description), sub: x(i.detail) },
            en ? `${formatNumber(i.quantity)} ${pluralEn(x(i.unit).toLowerCase(), i.quantity)}` : qtyLabel(i.quantity, i.unit),
            (i.priceText && x(i.priceText)) || (i.atCost ? L.atCost : `${formatMoney(i.unitPrice)}${i.discountPct ? ` (-${formatNumber(i.discountPct)}%)` : ""}`),
            i.taxRate > 0 ? `${L.tax} ${formatNumber(i.taxRate)}%` : L.exempt,
            formatMoney(i.amount),
          ])}
        />
        <SmallNote text={x(invoice.notes)} />

        <View wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
          <View style={{ flex: 1, paddingRight: 24 }}>
            {invoice.terms ? (
              <Text style={{ marginBottom: 8 }}>
                {L.terms}: {x(invoice.terms)}
              </Text>
            ) : null}
            <Text style={{ marginBottom: 8 }}>
              {L.reference}: <Text style={{ fontFamily: "Helvetica-Bold" }}>{invoice.folio}</Text>
            </Text>
            {bank.map(([k, v]) => (
              <Text key={k} style={{ color: C.muted }}>
                {k}: <Text style={{ color: C.ink }}>{v}</Text>
              </Text>
            ))}
            {invoice.payments.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 8, color: C.faint, marginBottom: 1 }}>{L.payments}</Text>
                {invoice.payments.map((p) => (
                  <Text key={p.id} style={{ fontSize: 8.5 }}>
                    {date(p.date)} · {x(p.method)}
                    {p.reference ? ` · ${L.ref} ${p.reference}` : ""} · {formatMoney(p.amount)}
                  </Text>
                ))}
              </View>
            )}
          </View>
          <TotalsBox
            s={s}
            rows={totalsRows}
            total={{ label: invoice.paidTotal > 0 ? L.balance : L.total, value: formatMoney(due) }}
            words={`${L.words}\n${en ? amountInWordsEn(due) : amountInWords(due)}`}
          />
        </View>

        <SmallNote text={x(s.invoiceDisclaimer)} style={{ marginTop: 14 }} />
      </CleanPage>
    </PdfDoc>
  );
}

// ───────────────────────────── Estado de cuenta ─────────────────────────────

type Statement = { client: Client; invoices: (Invoice & { payments: Payment[] })[] };

export function StatementPdf({ s, data }: { s: CompanySettings; data: Statement }) {
  const c = palette(s);
  const now = new Date();
  const open = data.invoices.filter((i) => i.status === "PENDIENTE" || i.status === "PARCIAL");
  const balance = round2(open.reduce((a, i) => a + i.total - i.paidTotal, 0));
  const overdue = round2(open.filter((i) => i.dueDate < now).reduce((a, i) => a + i.total - i.paidTotal, 0));

  return (
    <PdfDoc title={`Estado de cuenta ${data.client.name}`}>
      <BrandedPage s={s} footerLabel={`Estado de cuenta · ${data.client.name}`}>
        <DocTitle s={s} title="Estado de cuenta" subtitle={`${data.client.name} · Fecha de corte: ${formatDateLongEs(now)} · ${PRICES_NOTE}`} />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {[
            { l: "Saldo total", v: balance, color: c.blue },
            { l: "Vencido", v: overdue, color: "#b91c1c" },
            { l: "Por vencer", v: round2(balance - overdue), color: c.orange },
          ].map((k) => (
            <View key={k.l} style={[base.box, { flex: 1, backgroundColor: c.peach }]}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{k.l.toUpperCase()}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: k.color, marginTop: 2 }}>{formatMoney(k.v)}</Text>
            </View>
          ))}
        </View>

        <SectionTab s={s}>Facturas</SectionTab>
        <Table
          s={s}
          cols={[
            { title: "Folio", width: "14%" },
            { title: "Emisión", width: "13%" },
            { title: "Vence", width: "13%" },
            { title: "Estatus", width: "15%" },
            { title: "Total", width: "15%", align: "right" },
            { title: "Pagado", width: "15%", align: "right" },
            { title: "Saldo", width: "15%", align: "right" },
          ]}
          styles={["label", "normal", "normal", "normal", "normal", "normal", "strong"]}
          rows={data.invoices.map((inv) => {
            const bal = round2(inv.total - inv.paidTotal);
            const late = bal > 0 && inv.dueDate < now;
            return [inv.folio, formatDateNumEs(inv.issueDate), formatDateNumEs(inv.dueDate), late ? "Vencida" : STATUS_LABELS[inv.status], formatMoney(inv.total), formatMoney(inv.paidTotal), formatMoney(bal)];
          })}
        />
        {data.invoices.length === 0 && <Note>Sin facturas registradas.</Note>}
      </BrandedPage>
    </PdfDoc>
  );
}

// ───────────────────────────── Reporte financiero ─────────────────────────────

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
  const c = palette(s);
  const row = { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, paddingHorizontal: 7, borderBottomWidth: 0.5, borderBottomColor: "#e8e1da" } as const;
  const totalRow = (label: string, value: number, color?: string) => (
    <View style={[row, { backgroundColor: c.peach }]}>
      <Text style={base.bold}>{label}</Text>
      <Text style={[base.bold, color ? { color } : {}]}>{formatMoney(value)}</Text>
    </View>
  );
  const catRows = (rows: { category: string; amount: number; count: number }[], empty: string) =>
    rows.length ? (
      rows.map((r) => (
        <View key={r.category} style={row}>
          <Text>
            {r.category} <Text style={base.muted}>({r.count})</Text>
          </Text>
          <Text>{formatMoney(r.amount)}</Text>
        </View>
      ))
    ) : (
      <Text style={[base.muted, { padding: 7 }]}>{empty}</Text>
    );

  return (
    <PdfDoc title="Reporte financiero">
      <BrandedPage s={s} footerLabel="Reporte financiero">
        <DocTitle s={s} title="Reporte financiero" subtitle={`Del ${formatDateLongEs(from)} al ${formatDateLongEs(to)} · ${stmt.count} movimientos · Montos con IVA salvo indicación`} />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {[
            { l: "Ingresos", v: stmt.incomeTotal, color: "#047857" },
            { l: "Egresos", v: stmt.expenseTotal, color: "#b91c1c" },
            { l: "Flujo neto", v: stmt.cashFlow, color: stmt.cashFlow >= 0 ? c.blue : "#b91c1c" },
            { l: "Por cobrar", v: ar.total, color: c.orange },
          ].map((k) => (
            <View key={k.l} style={[base.box, { flex: 1, backgroundColor: c.peach }]}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{k.l.toUpperCase()}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: k.color, marginTop: 2 }}>{formatMoney(k.v)}</Text>
            </View>
          ))}
        </View>

        <SectionTab s={s}>Ingresos</SectionTab>
        <View style={{ height: 2, backgroundColor: c.blue }} />
        {catRows(stmt.income, "Sin ingresos en el periodo.")}
        {totalRow("Total ingresos", stmt.incomeTotal, "#047857")}

        <SectionTab s={s}>Egresos</SectionTab>
        <View style={{ height: 2, backgroundColor: c.blue }} />
        {catRows(stmt.expense, "Sin egresos en el periodo.")}
        {totalRow("Total egresos", stmt.expenseTotal, "#b91c1c")}

        <SectionTab s={s}>Resultado del periodo</SectionTab>
        <View wrap={false}>
          <View style={{ height: 2, backgroundColor: c.blue }} />
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

        <SectionTab s={s}>Antigüedad de cuentas por cobrar</SectionTab>
        <View wrap={false} style={{ flexDirection: "row", borderTopWidth: 2, borderTopColor: c.blue }}>
          {(Object.entries(ar.byBucket) as [string, number][]).map(([b, v]) => (
            <View key={b} style={{ flex: 1, padding: 6, borderWidth: 0.5, borderColor: tint(c.blue, 0.8) }}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{b === "corriente" ? "AL CORRIENTE" : `${b} DÍAS`}</Text>
              <Text style={[base.bold, { marginTop: 2 }]}>{formatMoney(v)}</Text>
            </View>
          ))}
        </View>
        {ar.rows.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Table
              s={s}
              cols={[
                { title: "Folio", width: "16%" },
                { title: "Cliente", width: "42%" },
                { title: "Vencimiento", width: "24%" },
                { title: "Saldo", width: "18%", align: "right" },
              ]}
              styles={["label", "normal", "normal", "strong"]}
              rows={ar.rows.slice(0, 60).map((r) => [r.folio, r.client.name, r.daysOverdue > 0 ? `${r.daysOverdue} días vencida` : `Vence ${formatDateEs(r.dueDate)}`, formatMoney(r.balance)])}
            />
          </View>
        )}
      </BrandedPage>
    </PdfDoc>
  );
}

// ───────────────────────────── Tarifario ─────────────────────────────

export function TariffPdf({
  s,
  sections,
  services,
  tables,
}: {
  s: CompanySettings;
  sections: ServiceSection[];
  services: Service[];
  tables: TariffTable[];
}) {
  const known = new Set(sections.map((x) => x.name));
  const groups = [
    ...sections.map((sec) => ({ name: sec.name, note: sec.note, items: services.filter((x) => x.section === sec.name) })),
    { name: "Otros servicios", note: "", items: services.filter((x) => !known.has(x.section)) },
  ];
  const placed = new Set<number>();
  const tablesAfter = (name: string) =>
    tables.filter((t) => t.afterSection === name).map((t) => {
      placed.add(t.id);
      return <InfoTable key={t.id} s={s} title={t.title} columns={t.columns} rows={t.rows} note={t.note} />;
    });
  const rate = (x: Service) => x.priceText || (x.atCost ? "Al costo" : formatMoney(x.unitPrice));

  // Lista plana (sin Views anidados): react-pdf calcula mal los saltos de página con contenedores profundos.
  const body = groups.flatMap((g) => [
    ...(g.items.length > 0
      ? [
          <Table
            key={`t-${g.name}`}
            s={s}
            head={
              <SectionTab s={s} bare>
                {g.name}
              </SectionTab>
            }
            cols={[
              { title: "Servicio", width: "21%" },
              { title: "Tarifa", width: "14%" },
              { title: "Unidad de cobro", width: "14%" },
              { title: "Descripción detallada", width: "51%" },
            ]}
            styles={["label", "rate", "normal", "normal"]}
            rows={g.items.map((x) => [x.name, rate(x), x.unit, x.description])}
          />,
          <Callout key={`n-${g.name}`} s={s} text={g.note} />,
        ]
      : []),
    ...tablesAfter(g.name),
  ]);
  const rest = tables.filter((t) => !placed.has(t.id) && !known.has(t.afterSection));

  return (
    <PdfDoc title={`Tarifario de Servicios — ${s.tradeName}`}>
      <BrandedPage s={s} footerLabel="Tarifario de Servicios">
        <DocTitle s={s} title="Tarifario de Servicios" subtitle="* Todos los precios mostrados son sin IVA · Moneda: pesos mexicanos (MXN)" />
        {s.tariffIntro ? <Text style={{ textAlign: "center", fontSize: 10.5, color: "#334155", lineHeight: 1.4, marginTop: -4, marginBottom: 6, paddingHorizontal: 30 }}>{s.tariffIntro}</Text> : null}
        {body}
        {rest.map((t) => (
          <InfoTable key={t.id} s={s} title={t.title} columns={t.columns} rows={t.rows} note={t.note} />
        ))}
        {(s.tariffTerms || s.quoteTerms).trim() && (
          <View>
            <SectionTab s={s}>Condiciones comerciales</SectionTab>
            <Conditions s={s} text={s.tariffTerms || s.quoteTerms} />
          </View>
        )}
        <Callout s={s} text={s.tariffClosing} />
      </BrandedPage>
    </PdfDoc>
  );
}
