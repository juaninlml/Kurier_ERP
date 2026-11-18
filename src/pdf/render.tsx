import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getSettingsWithLogo as getSettings } from "@/lib/settings";
import { incomeStatement, receivables, parseRange } from "@/lib/reports";
import { QuotePdf, InvoicePdf, StatementPdf, ReportPdf } from "./documents";

export async function renderQuote(id: number) {
  const [s, quote] = await Promise.all([
    getSettings(),
    prisma.quote.findUnique({ where: { id }, include: { client: true, items: { orderBy: { position: "asc" } } } }),
  ]);
  if (!quote) return null;
  const sections = await prisma.serviceSection.findMany();
  const sectionNotes = Object.fromEntries(sections.map((x) => [x.name, x.note]));
  return {
    filename: `Cotizacion_${slug(s.tradeName)}_${slug(quote.client.name)}_${quote.folio}.pdf`,
    buffer: await renderToBuffer(<QuotePdf s={s} quote={quote} sectionNotes={sectionNotes} />),
  };
}

export async function renderInvoice(id: number) {
  const [s, invoice] = await Promise.all([
    getSettings(),
    prisma.invoice.findUnique({
      where: { id },
      include: { client: true, quote: true, items: { orderBy: { position: "asc" } }, payments: { orderBy: { date: "asc" } } },
    }),
  ]);
  if (!invoice) return null;
  return { filename: `Factura_${invoice.folio}_${slug(invoice.client.name)}.pdf`, buffer: await renderToBuffer(<InvoicePdf s={s} invoice={invoice} />) };
}

export async function renderStatement(clientId: number) {
  const [s, client] = await Promise.all([
    getSettings(),
    prisma.client.findUnique({
      where: { id: clientId },
      include: { invoices: { where: { status: { not: "CANCELADA" } }, orderBy: { issueDate: "asc" }, include: { payments: true } } },
    }),
  ]);
  if (!client) return null;
  const { invoices, ...c } = client;
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
