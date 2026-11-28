import React from "react";
import { View, Text } from "./rp";
import type { Client, CompanySettings, Invoice, InvoiceItem, Payment, Quote, QuoteItem, Service, ServiceSection, TariffTable } from "@prisma/client";
import { BrandedPage, DocTitle, SectionTab, Table, Note, Conditions, PdfDoc, Callout, InfoTable, parseInfoTable, base, palette, tint } from "./brand";
import { CleanPage, PartyBlock, InfoGrid, SectionLabel, CleanTable, TotalsBox, SmallNote, CompactTerms, C, type CleanCell, type CleanCol } from "./clean";
import { parsePerOrder, parseVolumes, scenarioTable } from "@/lib/quote-extras";
import { quoteParty } from "@/lib/quote-party";
import { formatDate, formatDateLong, formatDateNum, formatDateNumEs, formatMoney, formatNumber, amountInWords, amountInWordsEn, amountInWordsZh, round2 } from "@/lib/money";
import { docText } from "@/lib/i18n/doc-text";
import { localeOf, translator, type Lang } from "@/lib/i18n";
import { groupBySection, rateLabel } from "@/lib/totals";
import type { incomeStatement, receivables } from "@/lib/reports";
import { STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, exchangeRateLabel, toMxn } from "@/lib/currency";

const PRICES_NOTE = "Todos los precios sin IVA, en pesos mexicanos (MXN)";
const qtyLabel = (q: number, unit: string) => `${formatNumber(q)} ${unit.toLowerCase()}`;
/** Plural simple en inglés para unidades ("package" → "packages"); las que ya terminan en s o llevan "/" se dejan. */
const pluralEn = (unit: string, qty: number) => (qty === 1 || !unit || /s$|\/|\s/.test(unit) ? unit : unit.endsWith("x") ? `${unit}es` : `${unit}s`);
/** Cantidad con su unidad en el idioma del formato ("3 paquetes" / "3 packages"). */
const qtyText = (q: number, unit: string, lang: Lang) =>
  lang === "en" ? `${formatNumber(q)} ${pluralEn(docText(unit, "en").toLowerCase(), q)}` : lang === "zh" ? `${formatNumber(q)} ${docText(unit, "zh")}` : qtyLabel(q, unit);
const taxLabel = (items: { taxRate: number }[], lang: Lang = "es") => {
  const t = translator(lang);
  const rates = [...new Set(items.filter((i) => i.taxRate > 0).map((i) => i.taxRate))];
  return rates.length === 1 ? `${t("IVA")} ${formatNumber(rates[0])}%` : t("IVA");
};
/** Textos del documento en el idioma pedido: `t` para los fijos, `x` para lo capturado (frases comunes), fechas locales. */
function texts(lang: Lang) {
  const loc = localeOf(lang);
  return {
    t: translator(lang),
    x: (text: string) => docText(text, lang),
    /** Condiciones capturadas: se traduce línea por línea lo que se reconoce. */
    lines: (text: string) => text.split("\n").map((l) => docText(l, lang)).join("\n"),
    dNum: (d: Date | string) => formatDateNum(d, loc),
    dShort: (d: Date | string) => formatDate(d, loc),
    dLong: (d: Date | string) => formatDateLong(d, loc),
  };
}

// ───────────────────────────── Cotización ─────────────────────────────

export function QuotePdf({
  s,
  quote,
  sectionNotes,
  infoTables = [],
  lang = "es",
}: {
  s: CompanySettings;
  quote: Quote & { client: Client | null; items: QuoteItem[] };
  sectionNotes: Record<string, string>;
  /** Tablas informativas del tarifario marcadas para imprimirse en cotizaciones (SLA, etc.). */
  infoTables?: TariffTable[];
  lang?: Lang;
}) {
  const { t, x, lines, dNum } = texts(lang);
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
  const tax = taxLabel(quote.items, lang);

  // Servicios: una sola tabla; cada sección es un subtítulo dentro de ella.
  const svcRows: CleanCell[][] = [];
  const svcGroups: Record<number, string> = {};
  const svcNotes = groups.map(([section]) => sectionNotes[section]).filter((n) => n?.trim()).map(x);
  for (const [section, items] of groups) {
    if (groups.length > 1 || section) svcGroups[svcRows.length] = section ? x(section) : t("Otros servicios");
    for (const i of items) svcRows.push([{ main: x(i.description), bold: true }, { main: x(rateLabel(i, formatMoney)), color: s.accentColor, bold: true }, x(i.detail)]);
  }

  return (
    <PdfDoc lang={lang} title={`${t("Cotización")} ${quote.folio} — ${party.name}`}>
      <CleanPage s={s} lang={lang} title={`${t("Cotización")} ${quote.folio}`} watermark={quote.status === "RECHAZADA" ? t("RECHAZADA") : undefined}>
        <PartyBlock
          name={party.legalName || party.name}
          lines={[party.legalName && party.legalName !== party.name ? party.name : "", party.rfc && `${t("RFC")}: ${party.rfc}`, quote.attention && `${t("Atención")}: ${quote.attention}`]}
        />

        <InfoGrid
          items={[
            { label: t("Fecha"), value: dNum(quote.issueDate) },
            { label: t("Vigente hasta"), value: dNum(quote.validUntil) },
            ...profile.filter((r) => r.label.trim() && r.value.trim()).map((r) => ({ label: x(r.label), value: x(r.value) })),
          ]}
        />

        {svcRows.length > 0 && (
          <CleanTable
            cols={[
              { title: t("Servicio"), width: "27%" },
              { title: t("Tarifa"), width: "20%" },
              { title: t("Descripción"), width: "53%" },
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
            <SectionLabel s={s}>{t("Costo por pedido")}</SectionLabel>
            <CleanTable
              cols={
                quote.perOrderFee > 0
                  ? [
                      { title: t("Tipo de pedido"), width: "58%" },
                      { title: "Fulfillment", width: "20%", align: "right" },
                      { title: t("Con guía de Kurier"), width: "22%", align: "right" },
                    ]
                  : [
                      { title: t("Tipo de pedido"), width: "75%" },
                      { title: "Fulfillment", width: "25%", align: "right" },
                    ]
              }
              rows={perOrder.map((r) =>
                quote.perOrderFee > 0
                  ? [x(r.label), formatMoney(r.amount), { main: formatMoney(round2(r.amount + quote.perOrderFee)), bold: true }]
                  : [x(r.label), { main: formatMoney(r.amount), bold: true }],
              )}
            />
            <SmallNote
              text={
                quote.perOrderFee > 0
                  ? t('Precios sin IVA. La columna "Con guía de Kurier" suma la comisión de {fee} por guía; no incluye el flete.', { fee: formatMoney(quote.perOrderFee) })
                  : t("Precios sin IVA.")
              }
            />
          </View>
        )}

        {scenarios && (
          <View wrap={scenarios.rows.length > 12}>
            <SectionLabel s={s}>{t("Costo mensual según volumen")}</SectionLabel>
            <CleanTable
              cols={scenarioCols(volumes, lang)}
              rows={[
                ...scenarios.rows.map((r) => [x(r.label), ...r.values.map((v) => formatMoney(v))]),
                [t("Subtotal sin IVA"), ...scenarios.subtotal.map((v) => formatMoney(v))].map((v) => ({ main: v, bold: true })),
                [tax, ...scenarios.tax.map((v) => formatMoney(v))],
                [t("Total mensual estimado"), ...scenarios.total.map((v) => formatMoney(v))].map((v) => ({ main: v, bold: true, color: s.accentColor })),
              ]}
            />
            <SmallNote text={x(quote.notes)} />
          </View>
        )}

        {!scenarios && estimate.length > 0 && (
          <View wrap={estimate.length > 12}>
            <SectionLabel s={s}>{t("Costo mensual estimado")}</SectionLabel>
            <CleanTable
              cols={[
                { title: t("Concepto"), width: "52%" },
                { title: t("Cantidad"), width: "16%", align: "right" },
                { title: t("Tarifa"), width: "15%", align: "right" },
                { title: t("Importe"), width: "17%", align: "right" },
              ]}
              rows={estimate.map((i) => [x(i.description), qtyText(i.quantity, i.unit, lang), i.atCost ? t("Al costo") : formatMoney(i.unitPrice), formatMoney(i.amount)])}
            />
            <View wrap={false} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
              <View style={{ flex: 1, paddingRight: 24 }}>
                <SmallNote text={x(quote.notes)} style={{ marginTop: 0 }} />
              </View>
              <TotalsBox
                s={s}
                rows={[
                  { label: t("Subtotal sin IVA"), value: formatMoney(quote.subtotal - quote.discount) },
                  ...(quote.discount > 0 ? [{ label: t("Descuento incluido"), value: formatMoney(-quote.discount) }] : []),
                  { label: tax, value: formatMoney(quote.tax) },
                ]}
                total={{ label: t("Total mensual estimado"), value: formatMoney(quote.total) }}
              />
            </View>
          </View>
        )}
        {!scenarios && estimate.length === 0 && <SmallNote text={x(quote.notes)} />}

        {infoTables.map((tb) => {
          const p = parseInfoTable(tb.columns, tb.rows);
          if (!p) return null;
          return (
            <View key={tb.id} wrap={p.data.length > 10}>
              <SectionLabel s={s}>{x(tb.title)}</SectionLabel>
              <CleanTable
                cols={p.cols.map((c) => ({ ...c, title: x(c.title) }))}
                rows={p.data.map((r) => r.map((raw, j): CleanCell => { const v = x(raw); return j === 0 ? { main: v, bold: true } : p.isRate ? { main: v, color: s.accentColor, bold: true } : v; }))}
              />
              <SmallNote text={x(tb.note)} />
            </View>
          );
        })}

        {quote.terms.trim() && (
          <View>
            <SectionLabel s={s}>{t("Condiciones comerciales")}</SectionLabel>
            <CompactTerms text={lines(quote.terms)} />
          </View>
        )}
        <SmallNote text={`${t(PRICES_NOTE)}.`} style={{ marginTop: 10 }} />
      </CleanPage>
    </PdfDoc>
  );
}

/** Columnas de la tabla de escenarios por volumen. */
function scenarioCols(volumes: number[], lang: Lang): CleanCol[] {
  const t = translator(lang);
  const w = volumes.length <= 3 ? 17 : 14;
  return [
    { title: t("Concepto"), width: `${100 - w * volumes.length}%` },
    ...volumes.map((v) => ({ title: t("{n} pedidos", { n: formatNumber(v) }), width: `${w}%`, align: "right" as const })),
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
    cnyNote: "Importes en yuan / renminbi (CNY).", mxnEq: "Equivalente en pesos mexicanos (MXN)", rate: "Tipo de cambio",
    totalMxn: "Total en pesos (MXN)", balanceMxn: "Saldo en pesos (MXN)",
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
    cnyNote: "Amounts in Chinese yuan / renminbi (CNY).", mxnEq: "Equivalent in Mexican pesos (MXN)", rate: "Exchange rate",
    totalMxn: "Total in pesos (MXN)", balanceMxn: "Balance in pesos (MXN)",
  },
  zh: {
    doc: "发票", subtitle: "账单格式 · 所有价格均不含增值税，以墨西哥比索（MXN）计价", footer: "发票格式",
    folio: "发票编号", folioNote: "内部参考编号", issue: "开票日期", due: "到期日", client: "客户", rfc: "税号（RFC）",
    period: "账单期间", volume: "本期业务量", storage: "仓储", terms: "付款条件", quote: "参考报价单",
    billing: "开票信息", detail: "已开票服务明细", concept: "项目", qty: "数量", unitPrice: "单价", amount: "金额",
    atCost: "按实际成本（浮动）", subtotal: "不含增值税小计", discount: "折扣", tax: "增值税", paid: "已付", balance: "未付余额", total: "应付总额",
    taxes: "税费", exempt: "免税", totalInv: "发票总额", words: "金额大写：",
    payments: "已收款项", ref: "参考号", payData: "付款信息", bank: "银行", account: "账号", clabe: "CLABE 账号", beneficiary: "收款人", reference: "付款参考号",
    cancelled: "已作废", paidMark: "已付款",
    cnyNote: "金额以人民币（CNY）计价。", mxnEq: "折合墨西哥比索（MXN）", rate: "汇率",
    totalMxn: "比索总额（MXN）", balanceMxn: "比索余额（MXN）",
  },
} as const;

export function InvoicePdf({
  s,
  invoice,
  lang = "es",
}: {
  s: CompanySettings;
  invoice: Invoice & { client: Client; items: InvoiceItem[]; payments: Payment[]; quote: Quote | null };
  /** Idioma del formato: los textos fijos y los conceptos comunes se traducen. */
  lang?: Lang;
}) {
  const L = INVOICE_L[lang];
  const en = lang === "en";
  const x = (text: string) => docText(text, lang);
  const date = (d: Date) => (lang === "es" ? formatDateNumEs(d) : formatDateNum(d, localeOf(lang)));
  const balance = round2(invoice.total - invoice.paidTotal);
  const cl = invoice.client;
  // Moneda de la factura: $ (MXN) o ¥ (CNY). En CNY se agrega el equivalente en pesos con el tipo de cambio guardado.
  const cny = invoice.currency === "CNY";
  const formatMoney = (n: number) => formatCurrency(n, invoice.currency);

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
    <PdfDoc lang={lang} title={`${L.doc} ${invoice.folio} — ${cl.name}`}>
      <CleanPage s={s} lang={lang} title={`${L.doc} ${invoice.folio}${cny ? " (CNY)" : ""}`} watermark={invoice.status === "CANCELADA" ? L.cancelled : invoice.status === "PAGADA" ? L.paidMark : undefined}>
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
            en ? `${formatNumber(i.quantity)} ${pluralEn(x(i.unit).toLowerCase(), i.quantity)}` : lang === "zh" ? `${formatNumber(i.quantity)} ${x(i.unit)}` : qtyLabel(i.quantity, i.unit),
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
            total={{ label: invoice.paidTotal > 0 ? L.balance : L.total, value: `${formatMoney(due)}${cny ? " CNY" : ""}` }}
            // Factura en yuanes: el total en pesos va justo debajo, igual de grande y resaltado
            totalAlt={cny ? { label: invoice.paidTotal > 0 ? L.balanceMxn : L.totalMxn, value: `${formatCurrency(toMxn(due, invoice))} MXN` } : undefined}
            words={`${L.words}\n${en ? amountInWordsEn(due, invoice.currency) : lang === "zh" ? amountInWordsZh(due, invoice.currency) : amountInWords(due, invoice.currency)}${cny ? `\n${L.rate}: ${exchangeRateLabel(invoice.exchangeRate)}` : ""}`}
          />
        </View>
        {cny && (
          <SmallNote
            style={{ marginTop: 10 }}
            text={`${L.cnyNote} ${L.mxnEq}: ${L.subtotal} ${formatCurrency(toMxn(invoice.subtotal, invoice))} · ${L.tax} ${formatCurrency(toMxn(invoice.tax, invoice))} · ${L.total} ${formatCurrency(toMxn(invoice.total, invoice))} MXN${invoice.paidTotal > 0 ? ` · ${L.balance} ${formatCurrency(toMxn(balance, invoice))} MXN` : ""}. ${L.rate}: ${exchangeRateLabel(invoice.exchangeRate)}.`}
          />
        )}

        <SmallNote text={x(s.invoiceDisclaimer)} style={{ marginTop: 14 }} />
      </CleanPage>
    </PdfDoc>
  );
}

// ───────────────────────────── Estado de cuenta ─────────────────────────────

type Statement = { client: Client; invoices: (Invoice & { payments: Payment[] })[] };

export function StatementPdf({ s, data, lang = "es" }: { s: CompanySettings; data: Statement; lang?: Lang }) {
  const { t, dNum, dLong } = texts(lang);
  const c = palette(s);
  const now = new Date();
  const open = data.invoices.filter((i) => i.status === "PENDIENTE" || i.status === "PARCIAL");
  // Saldos siempre en MXN: las facturas en yuanes se convierten con el tipo de cambio guardado en cada una.
  const balance = round2(open.reduce((a, i) => a + toMxn(i.total - i.paidTotal, i), 0));
  const overdue = round2(open.filter((i) => i.dueDate < now).reduce((a, i) => a + toMxn(i.total - i.paidTotal, i), 0));
  const hasCny = data.invoices.some((i) => i.currency === "CNY");

  return (
    <PdfDoc lang={lang} title={`${t("Estado de cuenta")} ${data.client.name}`}>
      <BrandedPage s={s} lang={lang} footerLabel={`${t("Estado de cuenta")} · ${data.client.name}`}>
        <DocTitle s={s} title={t("Estado de cuenta")} subtitle={`${data.client.name} · ${t("Fecha de corte")}: ${dLong(now)} · ${t(PRICES_NOTE)}`} />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {[
            { l: t("Saldo total"), v: balance, color: c.blue },
            { l: t("Vencido"), v: overdue, color: "#b91c1c" },
            { l: t("Por vencer"), v: round2(balance - overdue), color: c.orange },
          ].map((k) => (
            <View key={k.l} style={[base.box, { flex: 1, backgroundColor: c.peach }]}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{k.l.toUpperCase()}</Text>
              <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: k.color, marginTop: 2 }}>{formatMoney(k.v)}</Text>
            </View>
          ))}
        </View>

        <SectionTab s={s}>{t("Facturas")}</SectionTab>
        <Table
          s={s}
          cols={[
            { title: t("Folio"), width: "14%" },
            { title: t("Emisión"), width: "13%" },
            { title: t("Vencimiento"), width: "13%" },
            { title: t("Estatus"), width: "15%" },
            { title: t("Total"), width: "15%", align: "right" },
            { title: t("Pagado"), width: "15%", align: "right" },
            { title: t("Saldo"), width: "15%", align: "right" },
          ]}
          styles={["label", "normal", "normal", "normal", "normal", "normal", "strong"]}
          rows={data.invoices.map((inv) => {
            const bal = round2(inv.total - inv.paidTotal);
            const late = bal > 0 && inv.dueDate < now;
            const m = (n: number) => `${formatCurrency(n, inv.currency)}${inv.currency === "CNY" ? " CNY" : ""}`;
            return [inv.folio, dNum(inv.issueDate), dNum(inv.dueDate), t(late ? "Vencida" : STATUS_LABELS[inv.status]), m(inv.total), m(inv.paidTotal), m(bal)];
          })}
        />
        {hasCny && <Note>{t("Las facturas en yuanes (CNY) se muestran en su moneda; los saldos de arriba están en pesos (MXN) con el tipo de cambio guardado en cada factura.")}</Note>}
        {data.invoices.length === 0 && <Note>{t("Sin facturas registradas.")}</Note>}
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
  lang = "es",
}: {
  s: CompanySettings;
  from: Date;
  to: Date;
  stmt: Awaited<ReturnType<typeof incomeStatement>>;
  ar: Awaited<ReturnType<typeof receivables>>;
  lang?: Lang;
}) {
  const { t, x, dShort, dLong } = texts(lang);
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
            {x(r.category)} <Text style={base.muted}>({r.count})</Text>
          </Text>
          <Text>{formatMoney(r.amount)}</Text>
        </View>
      ))
    ) : (
      <Text style={[base.muted, { padding: 7 }]}>{empty}</Text>
    );

  return (
    <PdfDoc lang={lang} title={t("Reporte financiero")}>
      <BrandedPage s={s} lang={lang} footerLabel={t("Reporte financiero")}>
        <DocTitle
          s={s}
          title={t("Reporte financiero")}
          subtitle={t("Del {from} al {to} · {n} movimientos · Montos con IVA salvo indicación", { from: dLong(from), to: dLong(to), n: stmt.count })}
        />

        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          {[
            { l: t("Ingresos"), v: stmt.incomeTotal, color: "#047857" },
            { l: t("Egresos"), v: stmt.expenseTotal, color: "#b91c1c" },
            { l: t("Flujo neto"), v: stmt.cashFlow, color: stmt.cashFlow >= 0 ? c.blue : "#b91c1c" },
            { l: t("Por cobrar"), v: ar.total, color: c.orange },
          ].map((k) => (
            <View key={k.l} style={[base.box, { flex: 1, backgroundColor: c.peach }]}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{k.l.toUpperCase()}</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: k.color, marginTop: 2 }}>{formatMoney(k.v)}</Text>
            </View>
          ))}
        </View>

        <SectionTab s={s}>{t("Ingresos")}</SectionTab>
        <View style={{ height: 2, backgroundColor: c.blue }} />
        {catRows(stmt.income, t("Sin ingresos en el periodo."))}
        {totalRow(t("Total ingresos"), stmt.incomeTotal, "#047857")}

        <SectionTab s={s}>{t("Egresos")}</SectionTab>
        <View style={{ height: 2, backgroundColor: c.blue }} />
        {catRows(stmt.expense, t("Sin egresos en el periodo."))}
        {totalRow(t("Total egresos"), stmt.expenseTotal, "#b91c1c")}

        <SectionTab s={s}>{t("Resultado del periodo")}</SectionTab>
        <View wrap={false}>
          <View style={{ height: 2, backgroundColor: c.blue }} />
          {totalRow(t("Flujo neto (con IVA)"), stmt.cashFlow)}
          <View style={row}>
            <Text style={base.muted}>{t("IVA cobrado (en ingresos)")}</Text>
            <Text>{formatMoney(stmt.incomeTax)}</Text>
          </View>
          <View style={row}>
            <Text style={base.muted}>{t("IVA pagado (en egresos)")}</Text>
            <Text>{formatMoney(stmt.expenseTax)}</Text>
          </View>
          <View style={row}>
            <Text style={base.muted}>{t("Diferencia de IVA (estimado)")}</Text>
            <Text>{formatMoney(stmt.ivaBalance)}</Text>
          </View>
          {totalRow(t("Utilidad antes de impuestos (sin IVA)"), stmt.netBeforeTax, stmt.netBeforeTax >= 0 ? "#047857" : "#b91c1c")}
        </View>

        <SectionTab s={s}>{t("Antigüedad de cuentas por cobrar")}</SectionTab>
        <View wrap={false} style={{ flexDirection: "row", borderTopWidth: 2, borderTopColor: c.blue }}>
          {(Object.entries(ar.byBucket) as [string, number][]).map(([b, v]) => (
            <View key={b} style={{ flex: 1, padding: 6, borderWidth: 0.5, borderColor: tint(c.blue, 0.8) }}>
              <Text style={[base.muted, { fontSize: 7.5 }]}>{b === "corriente" ? t("AL CORRIENTE") : t("{b} DÍAS", { b })}</Text>
              <Text style={[base.bold, { marginTop: 2 }]}>{formatMoney(v)}</Text>
            </View>
          ))}
        </View>
        {ar.rows.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Table
              s={s}
              cols={[
                { title: t("Folio"), width: "16%" },
                { title: t("Cliente"), width: "42%" },
                { title: t("Vencimiento"), width: "24%" },
                { title: t("Saldo"), width: "18%", align: "right" },
              ]}
              styles={["label", "normal", "normal", "strong"]}
              rows={ar.rows
                .slice(0, 60)
                .map((r) => [r.folio, r.client.name, r.daysOverdue > 0 ? t("{n} días vencida", { n: r.daysOverdue }) : t("Vence {d}", { d: dShort(r.dueDate) }), formatMoney(r.balance)])}
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
  lang = "es",
}: {
  s: CompanySettings;
  sections: ServiceSection[];
  services: Service[];
  tables: TariffTable[];
  lang?: Lang;
}) {
  const { t, x, lines } = texts(lang);
  const known = new Set(sections.map((x) => x.name));
  const groups = [
    ...sections.map((sec) => ({ name: sec.name, note: sec.note, items: services.filter((x) => x.section === sec.name) })),
    { name: "Otros servicios", note: "", items: services.filter((x) => !known.has(x.section)) },
  ];
  const placed = new Set<number>();
  const tablesAfter = (name: string) =>
    tables.filter((tb) => tb.afterSection === name).map((tb) => {
      placed.add(tb.id);
      return <InfoTable key={tb.id} s={s} title={x(tb.title)} columns={tb.columns} rows={tb.rows} note={x(tb.note)} />;
    });
  const rate = (sv: Service) => (sv.priceText && x(sv.priceText)) || (sv.atCost ? t("Al costo") : formatMoney(sv.unitPrice));

  // Lista plana (sin Views anidados): react-pdf calcula mal los saltos de página con contenedores profundos.
  const body = groups.flatMap((g) => [
    ...(g.items.length > 0
      ? [
          <Table
            key={`t-${g.name}`}
            s={s}
            head={
              <SectionTab s={s} bare>
                {x(g.name)}
              </SectionTab>
            }
            cols={[
              { title: t("Servicio"), width: "21%" },
              { title: t("Tarifa"), width: "14%" },
              { title: t("Unidad de cobro"), width: "14%" },
              { title: t("Descripción detallada"), width: "51%" },
            ]}
            styles={["label", "rate", "normal", "normal"]}
            rows={g.items.map((sv) => [x(sv.name), rate(sv), x(sv.unit), x(sv.description)])}
          />,
          <Callout key={`n-${g.name}`} s={s} text={x(g.note)} />,
        ]
      : []),
    ...tablesAfter(g.name),
  ]);
  const rest = tables.filter((tb) => !placed.has(tb.id) && !known.has(tb.afterSection));

  return (
    <PdfDoc lang={lang} title={`${t("Tarifario de Servicios")} — ${s.tradeName}`}>
      <BrandedPage s={s} lang={lang} footerLabel={t("Tarifario de Servicios")}>
        <DocTitle s={s} title={t("Tarifario de Servicios")} subtitle={t("* Todos los precios mostrados son sin IVA · Moneda: pesos mexicanos (MXN)")} />
        {s.tariffIntro ? <Text style={{ textAlign: "center", fontSize: 10.5, color: "#334155", lineHeight: 1.4, marginTop: -4, marginBottom: 6, paddingHorizontal: 30 }}>{x(s.tariffIntro)}</Text> : null}
        {body}
        {rest.map((tb) => (
          <InfoTable key={tb.id} s={s} title={x(tb.title)} columns={tb.columns} rows={tb.rows} note={x(tb.note)} />
        ))}
        {(s.tariffTerms || s.quoteTerms).trim() && (
          <View>
            <SectionTab s={s}>{t("Condiciones comerciales")}</SectionTab>
            <Conditions s={s} text={lines(s.tariffTerms || s.quoteTerms)} />
          </View>
        )}
        <Callout s={s} text={x(s.tariffClosing)} />
      </BrandedPage>
    </PdfDoc>
  );
}
