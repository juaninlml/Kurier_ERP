import React from "react";
import { View, Text } from "@react-pdf/renderer";
import type { Client, CompanySettings, Invoice, InvoiceItem, Payment, Quote, QuoteItem, Service, ServiceSection, TariffTable } from "@prisma/client";
import { BrandedPage, DocTitle, SectionTab, Table, DataTable, Note, NoticeBox, Conditions, PdfDoc, Callout, InfoTable, base, palette, tint, GRAY } from "./brand";
import { parsePerOrder, parseVolumes, scenarioTable } from "@/lib/quote-extras";
import { quoteParty } from "@/lib/quote-party";
import { formatDateEs, formatDateLongEs, formatDateNumEs, formatMoney, formatNumber, amountInWords, round2 } from "@/lib/money";
import { groupBySection, rateLabel } from "@/lib/totals";
import type { incomeStatement, receivables } from "@/lib/reports";
import { STATUS_LABELS } from "@/lib/constants";

const PRICES_NOTE = "Todos los precios sin IVA, en pesos mexicanos (MXN)";
const qtyLabel = (q: number, unit: string) => `${formatNumber(q)} ${unit.toLowerCase()}`;
const taxLabel = (items: { taxRate: number }[]) => {
  const rates = [...new Set(items.filter((i) => i.taxRate > 0).map((i) => i.taxRate))];
  return rates.length === 1 ? `IVA ${formatNumber(rates[0])}%` : "IVA";
};

/** Renglones de totales alineados a la derecha (formato de factura). */
function Totals({
  s,
  rows,
  totalLabel,
  total,
}: {
  s: CompanySettings;
  rows: { label: string; value: string }[];
  totalLabel: string;
  total: number;
}) {
  const c = palette(s);
  return (
    <View wrap={false} style={{ marginTop: 14 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flexDirection: "row", justifyContent: "flex-end", paddingVertical: 2.5, paddingRight: 8 }}>
          <Text style={{ width: 160, textAlign: "right", fontFamily: "Helvetica-Bold", color: c.blue, fontSize: 9.5 }}>{r.label}</Text>
          <Text style={{ width: 110, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>{r.value}</Text>
        </View>
      ))}
      <View style={{ height: 1, backgroundColor: c.orange, marginTop: 5, marginBottom: 6 }} />
      <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingRight: 8 }}>
        <Text style={{ width: 160, textAlign: "right", fontFamily: "Helvetica-Bold", color: c.orange, fontSize: 12.5 }}>{totalLabel}</Text>
        <Text style={{ width: 110, textAlign: "right", fontFamily: "Helvetica-Bold", color: c.orange, fontSize: 15 }}>{formatMoney(total)}</Text>
      </View>
      <Text style={{ textAlign: "right", fontSize: 7.5, color: GRAY, marginTop: 4, paddingRight: 8 }}>{amountInWords(total)}</Text>
    </View>
  );
}

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
  const c = palette(s);
  const profile: { label: string; value: string }[] = (() => {
    try {
      return JSON.parse(quote.profile);
    } catch {
      return [];
    }
  })();
  const party = quoteParty(quote);
  const profileRows: [string, string][] = [
    ["Cliente", party.legalName || party.name],
    ...(party.rfc ? ([["RFC", party.rfc]] as [string, string][]) : []),
    ...profile.filter((r) => r.value.trim()).map((r) => [r.label, r.value] as [string, string]),
  ];
  const groups = groupBySection(quote.items);
  const estimate = quote.items.filter((i) => i.quantity > 0 && i.amount > 0);
  const perOrder = parsePerOrder(quote.perOrder);
  const volumes = parseVolumes(quote.scenarios);
  const scenarios = scenarioTable(quote.items, quote.baseVolume, volumes, formatMoney);
  const subtitle = [party.name, quote.attention && `Atención: ${quote.attention}`, PRICES_NOTE, formatDateLongEs(quote.issueDate)].filter(Boolean).join(" · ");

  return (
    <PdfDoc title={`Cotización ${quote.folio} — ${party.name}`}>
      <BrandedPage s={s} footerLabel={`Cotización de Fulfillment · ${party.name}`} watermark={quote.status === "RECHAZADA" ? "RECHAZADA" : undefined}>
        <DocTitle s={s} title="Cotización de Fulfillment" subtitle={subtitle} extra={`Folio ${quote.folio} · Vigente hasta el ${formatDateLongEs(quote.validUntil)}`} />

        <SectionTab s={s} full>
          Perfil de la operación cotizada
        </SectionTab>
        <DataTable s={s} rows={profileRows} />

        {groups.map(([section, items]) => (
          <View key={section}>
            <SectionTab s={s} full>
              {section}
            </SectionTab>
            <Table
              s={s}
              cols={[
                { title: "Servicio", width: "27%" },
                { title: "Tarifa", width: "20%" },
                { title: "Descripción", width: "53%" },
              ]}
              styles={["label", "rate", "normal"]}
              rows={items.map((i) => [i.description, rateLabel(i, formatMoney), i.detail])}
            />
            <Note>{sectionNotes[section] ?? ""}</Note>
          </View>
        ))}

        {perOrder.length > 0 && (
          <View wrap={false}>
            <SectionTab s={s} full>
              Costo por pedido
            </SectionTab>
            <Table
              s={s}
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
              styles={["label", "normal", "label"]}
              rows={perOrder.map((r) =>
                quote.perOrderFee > 0 ? [r.label, formatMoney(r.amount), formatMoney(round2(r.amount + quote.perOrderFee))] : [r.label, formatMoney(r.amount)],
              )}
            />
            <Note>
              {quote.perOrderFee > 0
                ? `Precios sin IVA. La columna "Con guía de Kurier" suma la comisión de ${formatMoney(quote.perOrderFee)} por guía; no incluye el flete.`
                : "Precios sin IVA."}
            </Note>
          </View>
        )}

        {scenarios && (
          <View wrap={scenarios.rows.length > 12}>
            <SectionTab s={s} full>
              Costo mensual de fulfillment según volumen
            </SectionTab>
            <ScenarioTable s={s} volumes={volumes} data={scenarios} taxText={taxLabel(quote.items)} />
            <Note>{quote.notes}</Note>
          </View>
        )}

        {!scenarios && estimate.length > 0 && (
          <View wrap={estimate.length > 12}>
            <SectionTab s={s} full>
              Costo mensual estimado
            </SectionTab>
            <Table
              s={s}
              cols={[
                { title: "Concepto", width: "52%" },
                { title: "Cantidad", width: "16%", align: "right" },
                { title: "Tarifa", width: "15%", align: "right" },
                { title: "Importe", width: "17%", align: "right" },
              ]}
              styles={["normal", "normal", "normal", "strong"]}
              rows={estimate.map((i) => [
                i.description,
                qtyLabel(i.quantity, i.unit),
                i.atCost ? "Al costo" : formatMoney(i.unitPrice),
                formatMoney(i.amount),
              ])}
            />
            <View wrap={false}>
              {[
                { l: "Subtotal sin IVA", v: quote.subtotal - quote.discount, strong: true },
                ...(quote.discount > 0 ? [{ l: "Descuento incluido", v: -quote.discount, strong: false }] : []),
                { l: taxLabel(quote.items), v: quote.tax, strong: false },
              ].map((r) => (
                <View key={r.l} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 7, borderBottomWidth: 0.5, borderBottomColor: "#e8e1da", borderTopWidth: r.strong ? 1 : 0, borderTopColor: c.blue }}>
                  <Text style={r.strong ? base.bold : {}}>{r.l}</Text>
                  <Text style={r.strong ? base.bold : {}}>{formatMoney(r.v)}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, paddingHorizontal: 7, borderTopWidth: 1, borderTopColor: c.orange }}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: c.orange, fontSize: 10.5 }}>Total mensual estimado</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", color: c.orange, fontSize: 10.5 }}>{formatMoney(quote.total)}</Text>
              </View>
            </View>
            <Note>{quote.notes}</Note>
          </View>
        )}
        {!scenarios && estimate.length === 0 && <Note>{quote.notes}</Note>}

        {infoTables.map((t) => (
          <InfoTable key={t.id} s={s} full title={t.title} columns={t.columns} rows={t.rows} note={t.note} />
        ))}

        {quote.terms.trim() && (
          <View>
            <SectionTab s={s} full>
              Condiciones comerciales
            </SectionTab>
            <Conditions s={s} text={quote.terms} />
          </View>
        )}
      </BrandedPage>
    </PdfDoc>
  );
}

// ───────────────────────────── Factura ─────────────────────────────

export function InvoicePdf({
  s,
  invoice,
}: {
  s: CompanySettings;
  invoice: Invoice & { client: Client; items: InvoiceItem[]; payments: Payment[]; quote: Quote | null };
}) {
  const balance = round2(invoice.total - invoice.paidTotal);
  const data: [string, string][] = [
    ["Folio", `${invoice.folio} (folio interno de referencia)`],
    ["Fecha de emisión", formatDateNumEs(invoice.issueDate)],
    ["Fecha de vencimiento", formatDateNumEs(invoice.dueDate)],
    ["Cliente", invoice.client.legalName || invoice.client.name],
    ["RFC", invoice.client.rfc || "—"],
  ];
  if (invoice.period) data.push(["Periodo facturado", invoice.period]);
  if (invoice.volume) data.push(["Volumen del periodo", invoice.volume]);
  if (invoice.storage) data.push(["Almacenamiento", invoice.storage]);
  if (invoice.terms) data.push(["Condiciones de pago", invoice.terms]);
  if (invoice.quote) data.push(["Cotización de referencia", invoice.quote.folio]);

  const totalsRows = [{ label: "Subtotal sin IVA", value: formatMoney(invoice.subtotal) }];
  if (invoice.discount > 0) totalsRows.push({ label: "Descuento", value: `-${formatMoney(invoice.discount)}` });
  totalsRows.push({ label: taxLabel(invoice.items), value: formatMoney(invoice.tax) });

  const bank = [
    s.bankName && `Banco: ${s.bankName}`,
    s.bankAccount && `Cuenta: ${s.bankAccount}`,
    s.clabe && `CLABE: ${s.clabe}`,
    s.legalName && `Beneficiario: ${s.legalName}`,
  ].filter(Boolean) as string[];
  const c = palette(s);

  return (
    <PdfDoc title={`Factura ${invoice.folio} — ${invoice.client.name}`}>
      <BrandedPage
        s={s}
        footerLabel="Formato de Factura"
        watermark={invoice.status === "CANCELADA" ? "CANCELADA" : invoice.status === "PAGADA" ? "PAGADA" : undefined}
      >
        <DocTitle s={s} title="Factura" subtitle={`Formato de facturación · ${PRICES_NOTE}`} />

        <SectionTab s={s}>Datos de facturación</SectionTab>
        <DataTable s={s} rows={data} />

        <SectionTab s={s}>Detalle de servicios facturados</SectionTab>
        <Table
          s={s}
          cols={[
            { title: "Concepto", width: "48%" },
            { title: "Cantidad", width: "15%", align: "center" },
            { title: "Precio unitario", width: "19%", align: "right" },
            { title: "Importe", width: "18%", align: "right" },
          ]}
          rows={invoice.items.map((i) => [
            i.description,
            qtyLabel(i.quantity, i.unit),
            i.priceText || (i.atCost ? "Variable (al costo)" : `${formatMoney(i.unitPrice)}${i.discountPct ? ` (-${formatNumber(i.discountPct)}%)` : ""}`),
            formatMoney(i.amount),
          ])}
        />
        <Note>{invoice.notes}</Note>

        <Totals
          s={s}
          rows={[
            ...totalsRows,
            ...(invoice.paidTotal > 0 ? [{ label: "Pagado", value: formatMoney(invoice.paidTotal) }] : []),
          ]}
          totalLabel={invoice.paidTotal > 0 ? "Saldo pendiente" : "Total a pagar"}
          total={invoice.paidTotal > 0 ? balance : invoice.total}
        />

        {invoice.payments.length > 0 && (
          <View wrap={false} style={{ marginTop: 14 }}>
            <Text style={[base.sectionTitle, { color: c.blue }]}>Pagos recibidos</Text>
            {invoice.payments.map((p) => (
              <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0" }}>
                <Text>
                  {formatDateNumEs(p.date)} · {p.method}
                  {p.reference ? ` · Ref. ${p.reference}` : ""}
                </Text>
                <Text style={base.bold}>{formatMoney(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {bank.length > 0 && (
          <View wrap={false} style={[base.box, { marginTop: 14, borderWidth: 1, borderColor: c.line }]}>
            <Text style={[base.sectionTitle, { color: c.blue }]}>Datos para pago</Text>
            {bank.map((b) => (
              <Text key={b}>{b}</Text>
            ))}
            <Text style={[base.muted, { marginTop: 3 }]}>Referencia: {invoice.folio}</Text>
          </View>
        )}

        <NoticeBox s={s} text={s.invoiceDisclaimer} />
      </BrandedPage>
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

// ───────────────────── Escenarios por volumen (cotización) ─────────────────────

function ScenarioTable({
  s,
  volumes,
  data,
  taxText,
}: {
  s: CompanySettings;
  volumes: number[];
  data: NonNullable<ReturnType<typeof scenarioTable>>;
  taxText: string;
}) {
  const c = palette(s);
  const w = volumes.length <= 3 ? 17 : 14;
  const first = `${100 - w * volumes.length}%`;
  const cols = [
    { title: "Concepto", width: first },
    ...volumes.map((v) => ({ title: `${formatNumber(v)} pedidos`, width: `${w}%`, align: "right" as const })),
  ];
  const row = (label: string, values: number[], kind: "sub" | "tax" | "total") => (
    <View
      key={label}
      style={{
        flexDirection: "row",
        paddingVertical: kind === "total" ? 7 : 6,
        borderBottomWidth: 0.5,
        borderBottomColor: "#e8e1da",
        borderTopWidth: kind === "tax" ? 0 : 1,
        borderTopColor: kind === "total" ? c.orange : c.blue,
        backgroundColor: kind === "tax" ? c.peach : "#fff",
      }}
    >
      {[label, ...values.map((v) => formatMoney(v))].map((v, j) => (
        <Text
          key={j}
          style={{
            width: cols[j].width,
            paddingHorizontal: 7,
            textAlign: j === 0 ? "left" : "right",
            fontSize: kind === "total" ? 10 : 9,
            fontFamily: kind === "tax" ? "Helvetica" : "Helvetica-Bold",
            color: kind === "total" ? c.orange : undefined,
          }}
        >
          {v}
        </Text>
      ))}
    </View>
  );
  return (
    <View>
      <Table s={s} cols={cols} rows={data.rows.map((r) => [r.label, ...r.values.map((v) => formatMoney(v))])} />
      <View wrap={false}>
        {row("Subtotal sin IVA", data.subtotal, "sub")}
        {row(taxText, data.tax, "tax")}
        {row("Total mensual estimado", data.total, "total")}
      </View>
    </View>
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
