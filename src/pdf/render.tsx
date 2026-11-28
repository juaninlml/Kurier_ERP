import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getSettingsWithLogo as getSettings } from "@/lib/settings";
import { incomeStatement, receivables, parseRange } from "@/lib/reports";
import { quoteParty } from "@/lib/quote-party";
import { applyBrand } from "@/lib/brands";
import { QuotePdf, InvoicePdf, StatementPdf, ReportPdf, TariffPdf } from "./documents";
import { translator, type Lang } from "@/lib/i18n";

/*
 * Todos los formatos salen en el idioma de quien los pide (`lang`); por omisión en español
 * (las copias que se guardan en Drive siempre van en español).
 */

export async function renderQuote(id: number, lang: Lang = "es") {
  const t = translator(lang);
  const [base, quote] = await Promise.all([
    getSettings(),
    prisma.quote.findUnique({ where: { id }, include: { client: true, brand: true, items: { orderBy: { position: "asc" } } } }),
  ]);
  if (!quote) return null;
  const s = applyBrand(base, quote.brand);
  const [sections, infoTables] = await Promise.all([
    prisma.serviceSection.findMany(),
    prisma.tariffTable.findMany({ where: { inQuotes: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  const sectionNotes = Object.fromEntries(sections.map((x) => [x.name, x.note]));
  return {
    filename: `${slug(t("Cotización"))}_${slug(s.tradeName)}_${slug(quoteParty(quote).name)}_${quote.folio}.pdf`,
    buffer: await renderToBuffer(<QuotePdf s={s} quote={quote} sectionNotes={sectionNotes} infoTables={infoTables} lang={lang} />),
  };
}

/** Factura en PDF. `lang` = idioma del usuario que la pide (la copia de Drive siempre en español). */
export async function renderInvoice(id: number, lang: "es" | "en" = "es") {
  const [base, invoice] = await Promise.all([
    getSettings(),
    prisma.invoice.findUnique({
      where: { id },
      include: { client: true, quote: true, brand: true, items: { orderBy: { position: "asc" } }, payments: { orderBy: { date: "asc" } } },
    }),
  ]);
  if (!invoice) return null;
  const s = applyBrand(base, invoice.brand);
  return {
    filename: `${lang === "en" ? "Invoice" : "Factura"}_${invoice.folio}_${slug(invoice.client.name)}.pdf`,
    buffer: await renderToBuffer(<InvoicePdf s={s} invoice={invoice} lang={lang} />),
  };
}

export async function renderStatement(clientId: number, lang: Lang = "es") {
  const t = translator(lang);
  const [base, client] = await Promise.all([
    getSettings(),
    prisma.client.findUnique({
      where: { id: clientId },
      include: { brand: true, invoices: { where: { status: { not: "CANCELADA" } }, orderBy: { issueDate: "asc" }, include: { payments: true } } },
    }),
  ]);
  if (!client) return null;
  const s = applyBrand(base, client.brand);
  const { invoices, brand: _brand, ...c } = client;
  return {
    filename: `${slug(t("Estado de cuenta"))}_${slug(c.name)}.pdf`,
    buffer: await renderToBuffer(<StatementPdf s={s} data={{ client: c as typeof client, invoices }} lang={lang} />),
  };
}

export async function renderReport(fromStr?: string, toStr?: string, lang: Lang = "es") {
  const t = translator(lang);
  const { from, to } = parseRange(fromStr, toStr);
  const [s, stmt, ar] = await Promise.all([getSettings(), incomeStatement(from, to), receivables()]);
  const tag = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
  return { filename: `${slug(t("Reporte financiero"))}_${tag}.pdf`, buffer: await renderToBuffer(<ReportPdf s={s} from={from} to={to} stmt={stmt} ar={ar} lang={lang} />) };
}

export async function renderTariff(lang: Lang = "es") {
  const t = translator(lang);
  const [s, sections, services, tables] = await Promise.all([
    getSettings(),
    prisma.serviceSection.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.service.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.tariffTable.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  return {
    filename: `${slug(t("Tarifario de Servicios"))}_${slug(s.tradeName)}.pdf`,
    buffer: await renderToBuffer(<TariffPdf s={s} sections={sections} services={services} tables={tables} lang={lang} />),
  };
}

/** "Cestco Dental" → "CestcoDental" (sin acentos ni símbolos, apto para nombre de archivo). */
function slug(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** Recibos de nómina de una semana (o de un solo empleado con `lineId`). */
export async function renderPayrollReceipts(runId: number, lineId?: number, lang: Lang = "es") {
  const { jobCatalog } = await import("@/lib/payroll-data");
  const { groupByOrg } = await import("@/lib/org");
  const [base, run, catalog] = await Promise.all([
    getSettings(),
    prisma.payrollRun.findUnique({
      where: { id: runId },
      include: { brand: true, lines: { where: lineId ? { id: lineId } : undefined, include: { employee: true }, orderBy: { employee: { name: "asc" } } } },
    }),
    jobCatalog(),
  ]);
  if (!run || run.lines.length === 0) return null;
  // Recibos en el orden de la nómina: por área y después por departamento
  const lines = groupByOrg(run.lines, (l) => l.employee, catalog).flatMap((g) => g.departments.flatMap((d) => d.items));
  // Los recibos salen con los datos y el logo de la marca que paga la nómina
  const s = applyBrand(base, run.brand);
  const { PayrollReceiptsPdf } = await import("./payroll");
  const tag = run.periodStart.toISOString().slice(0, 10);
  const who = lineId ? `_${slug(run.lines[0].employee.name)}` : "";
  return {
    filename: `${lang === "en" ? "Payroll_receipts" : "Recibos_nomina"}_${tag}${who}.pdf`,
    buffer: await renderToBuffer(<PayrollReceiptsPdf s={s} run={run} lines={lines} lang={lang} />),
  };
}

/** Resumen de órdenes diarias de un cliente en un periodo (yyyy-mm-dd, inclusive). */
export async function renderOrdersSummary(clientId: number, from: string, to: string, lang: Lang = "es") {
  const { clientOrdersSummary } = await import("@/lib/orders");
  const [base, data] = await Promise.all([getSettings(), clientOrdersSummary(clientId, from, to)]);
  if (!data) return null;
  const s = applyBrand(base, data.client.brand);
  const { OrdersSummaryPdf } = await import("./orders");
  return {
    filename: `${lang === "en" ? "Orders_summary" : "Resumen_ordenes"}_${slug(data.client.name)}_${from}_${to}.pdf`,
    buffer: await renderToBuffer(<OrdersSummaryPdf s={s} data={data} lang={lang} />),
  };
}

/** Formato de una incidencia (vacaciones, permiso, falta o descanso por retardos). */
export async function renderIncident(id: number, lang: Lang = "es") {
  const { seniority, vacationDaysFor, VACATION_PREMIUM } = await import("@/lib/payroll");
  const { vacationTakenMap } = await import("@/lib/payroll-data");
  const { addDaysStr, isWorkday } = await import("@/lib/attendance");
  const { incidentFolio } = await import("@/lib/incidents");
  const [s, i] = await Promise.all([getSettings(), prisma.incident.findUnique({ where: { id }, include: { employee: true } })]);
  if (!i) return null;
  const e = i.employee;
  const at = new Date(`${i.startDate}T12:00:00Z`);
  const sen = seniority(e.startDate, at);
  const en = lang === "en";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const senLabel =
    [
      sen.years ? plural(sen.years, en ? "year" : "año", en ? "years" : "años") : "",
      sen.months ? plural(sen.months, en ? "month" : "mes", en ? "months" : "meses") : "",
      !sen.years && !sen.months ? plural(sen.days, en ? "day" : "día", en ? "days" : "días") : "",
    ]
      .filter(Boolean)
      .join(", ");
  let vacation;
  if (i.type === "VACACIONES") {
    const total = (await vacationTakenMap([e], at)).get(e.id) ?? 0;
    const entitled = vacationDaysFor(sen.years);
    // Las autorizadas ya están en el total (por nómina o programadas); las pendientes no
    const takenBefore = Math.max(0, i.status === "AUTORIZADA" ? total - i.days : total);
    let back = addDaysStr(i.endDate, 1);
    while (!isWorkday(back, e)) back = addDaysStr(back, 1);
    vacation = {
      seniority: senLabel,
      periodFrom: sen.lastAnniversary,
      periodTo: new Date(sen.nextAnniversary.getTime() - 86400000),
      entitled,
      takenBefore,
      balance: Math.round((entitled - takenBefore - i.days) * 100) / 100,
      premium: Math.round(i.days * e.dailySalary * VACATION_PREMIUM * 100) / 100,
      returnDate: back,
    };
  }
  const { IncidentPdf } = await import("./incidents");
  return {
    filename: `${incidentFolio(i)}_${slug(e.name)}.pdf`,
    buffer: await renderToBuffer(<IncidentPdf s={s} i={i} e={e} seniority={senLabel} vacation={vacation} lang={lang} />),
  };
}

/** Guía de última milla 4 × 6 (una página por bulto). `sheet` = en hoja carta con líneas de corte. */
export async function renderShipmentLabel(id: number, sheet = false, origin = "", lang: Lang = "es") {
  const [base, sh] = await Promise.all([getSettings(), prisma.shipment.findUnique({ where: { id }, include: { client: { include: { brand: true } } } })]);
  if (!sh) return null;
  const s = applyBrand(base, sh.client?.brand ?? null);
  const { ShipmentLabelPdf } = await import("./label");
  return { filename: `${lang === "en" ? "Label_LastMile" : "Guia_UltimaMilla"}_${sh.tracking}${sheet ? (lang === "en" ? "_letter" : "_carta") : ""}.pdf`, buffer: await renderToBuffer(<ShipmentLabelPdf s={s} sh={sh} sheet={sheet} trackUrl={origin ? `${origin}/rastreo/${sh.tracking}` : ""} lang={lang} />) };
}

/** Etiquetas de almacenamiento: una (id) o todas las activas (sin id). */
export async function renderStorageLabels(id?: number, lang: Lang = "es") {
  const units = await prisma.storageUnit.findMany({ where: id ? { id } : { active: true }, orderBy: { name: "asc" } });
  if (!units.length) return null;
  const { StorageLabelPdf } = await import("./storage-label");
  return {
    filename: units.length === 1 ? `${lang === "en" ? "Storage" : "Almacenamiento"}_${units[0].code}.pdf` : lang === "en" ? "Storage_labels.pdf" : "Almacenamientos.pdf",
    buffer: await renderToBuffer(<StorageLabelPdf units={units} lang={lang} />),
  };
}

/** Hoja de salida de mercancía; `id` null = formato en blanco para llenar a mano. */
export async function renderGoodsExit(id: number | null, lang: Lang = "es") {
  const s = await getSettings();
  const { GoodsExitPdf } = await import("./goods-exit");
  if (id === null) {
    return { filename: lang === "en" ? "Blank_goods_exit_sheet.pdf" : "Hoja_de_salida_en_blanco.pdf", buffer: await renderToBuffer(<GoodsExitPdf s={s} x={{ items: [] }} lang={lang} />) };
  }
  const e = await prisma.goodsExit.findUnique({ where: { id }, include: { client: { select: { name: true } }, items: { orderBy: { position: "asc" } } } });
  if (!e) return null;
  return {
    filename: `${lang === "en" ? "Exit" : "Salida"}_${e.folio}_${slug(e.client.name)}.pdf`,
    buffer: await renderToBuffer(<GoodsExitPdf s={s} x={{ ...e, client: e.client.name }} lang={lang} />),
  };
}
