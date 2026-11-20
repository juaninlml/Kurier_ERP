import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getSettingsWithLogo as getSettings } from "@/lib/settings";
import { incomeStatement, receivables, parseRange } from "@/lib/reports";
import { quoteParty } from "@/lib/quote-party";
import { applyBrand } from "@/lib/brands";
import { QuotePdf, InvoicePdf, StatementPdf, ReportPdf, TariffPdf } from "./documents";

export async function renderQuote(id: number) {
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
    filename: `Cotizacion_${slug(s.tradeName)}_${slug(quoteParty(quote).name)}_${quote.folio}.pdf`,
    buffer: await renderToBuffer(<QuotePdf s={s} quote={quote} sectionNotes={sectionNotes} infoTables={infoTables} />),
  };
}

export async function renderInvoice(id: number) {
  const [base, invoice] = await Promise.all([
    getSettings(),
    prisma.invoice.findUnique({
      where: { id },
      include: { client: true, quote: true, brand: true, items: { orderBy: { position: "asc" } }, payments: { orderBy: { date: "asc" } } },
    }),
  ]);
  if (!invoice) return null;
  const s = applyBrand(base, invoice.brand);
  return { filename: `Factura_${invoice.folio}_${slug(invoice.client.name)}.pdf`, buffer: await renderToBuffer(<InvoicePdf s={s} invoice={invoice} />) };
}

export async function renderStatement(clientId: number) {
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
    filename: `Estado_de_cuenta_${slug(c.name)}.pdf`,
    buffer: await renderToBuffer(<StatementPdf s={s} data={{ client: c as typeof client, invoices }} />),
  };
}

export async function renderReport(fromStr?: string, toStr?: string) {
  const { from, to } = parseRange(fromStr, toStr);
  const [s, stmt, ar] = await Promise.all([getSettings(), incomeStatement(from, to), receivables()]);
  const tag = `${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}`;
  return { filename: `Reporte_${tag}.pdf`, buffer: await renderToBuffer(<ReportPdf s={s} from={from} to={to} stmt={stmt} ar={ar} />) };
}

export async function renderTariff() {
  const [s, sections, services, tables] = await Promise.all([
    getSettings(),
    prisma.serviceSection.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.service.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.tariffTable.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  return {
    filename: `Tarifario_${slug(s.tradeName)}.pdf`,
    buffer: await renderToBuffer(<TariffPdf s={s} sections={sections} services={services} tables={tables} />),
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
export async function renderPayrollReceipts(runId: number, lineId?: number) {
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
    filename: `Recibos_nomina_${tag}${who}.pdf`,
    buffer: await renderToBuffer(<PayrollReceiptsPdf s={s} run={run} lines={lines} />),
  };
}

/** Resumen de órdenes diarias de un cliente en un periodo (yyyy-mm-dd, inclusive). */
export async function renderOrdersSummary(clientId: number, from: string, to: string) {
  const { clientOrdersSummary } = await import("@/lib/orders");
  const [base, data] = await Promise.all([getSettings(), clientOrdersSummary(clientId, from, to)]);
  if (!data) return null;
  const s = applyBrand(base, data.client.brand);
  const { OrdersSummaryPdf } = await import("./orders");
  return {
    filename: `Resumen_ordenes_${slug(data.client.name)}_${from}_${to}.pdf`,
    buffer: await renderToBuffer(<OrdersSummaryPdf s={s} data={data} />),
  };
}

/** Formato de una incidencia (vacaciones, permiso, falta o descanso por retardos). */
export async function renderIncident(id: number) {
  const { seniority, vacationDaysFor, VACATION_PREMIUM } = await import("@/lib/payroll");
  const { vacationTakenMap } = await import("@/lib/payroll-data");
  const { addDaysStr, isWorkday } = await import("@/lib/attendance");
  const { incidentFolio } = await import("@/lib/incidents");
  const [s, i] = await Promise.all([getSettings(), prisma.incident.findUnique({ where: { id }, include: { employee: true } })]);
  if (!i) return null;
  const e = i.employee;
  const at = new Date(`${i.startDate}T12:00:00Z`);
  const sen = seniority(e.startDate, at);
  // Siempre en español (los formatos no se traducen)
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const senLabel =
    [sen.years ? plural(sen.years, "año", "años") : "", sen.months ? plural(sen.months, "mes", "meses") : "", !sen.years && !sen.months ? plural(sen.days, "día", "días") : ""]
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
    buffer: await renderToBuffer(<IncidentPdf s={s} i={i} e={e} seniority={senLabel} vacation={vacation} />),
  };
}
