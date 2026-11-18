import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildInvoiceLines, periodText, type RateLike } from "./billing";
import { normalize, wmsStatementSchema, type WmsStatement } from "./types";

const toDate = (d?: string) => (d ? new Date(`${d}T12:00:00Z`) : null);

/** Busca el cliente del ERP que corresponde al nombre que trae el WMS. */
export async function matchClient(wmsName: string) {
  const key = normalize(wmsName).replace(/\s/g, "");
  if (!key) return null;
  const clients = await prisma.client.findMany({ select: { id: true, name: true, wmsName: true, legalName: true } });
  const squash = (t: string) => normalize(t).replace(/\s/g, "");
  return (
    clients.find((c) => c.wmsName && squash(c.wmsName) === key) ??
    clients.find((c) => squash(c.name) === key || (c.legalName && squash(c.legalName) === key)) ??
    null
  );
}

/**
 * Guarda (o actualiza) un estado de cobro del WMS para revisarlo antes de facturar.
 * Se usa igual desde el lector de PDF y desde la API.
 */
export async function saveStatement(input: unknown, source: "pdf" | "api") {
  const st = wmsStatementSchema.parse(input);
  const existing = await prisma.wmsImport.findUnique({ where: { folio: st.folio }, include: { invoice: { select: { folio: true } } } });
  if (existing?.status === "FACTURADO") {
    throw new Error(`El estado de cobro ${st.folio} ya se facturó${existing.invoice ? ` en ${existing.invoice.folio}` : ""}.`);
  }
  const client = await matchClient(st.clientName);
  const data = {
    source,
    clientName: st.clientName,
    clientId: existing?.clientId ?? client?.id ?? null,
    periodLabel: st.periodLabel,
    periodFrom: toDate(st.periodFrom),
    periodTo: toDate(st.periodTo),
    issuedAt: toDate(st.issuedAt),
    payload: JSON.stringify(st),
    subtotal: st.subtotal,
    tax: st.tax,
    total: st.total,
    status: "PENDIENTE",
  };
  return prisma.wmsImport.upsert({ where: { folio: st.folio }, create: { folio: st.folio, ...data }, update: data });
}

export function statementOf(imp: { payload: string }): WmsStatement {
  return wmsStatementSchema.parse(JSON.parse(imp.payload));
}

const toRate = (r: {
  code: string;
  name: string;
  description: string;
  wmsConcept: string;
  unit: string;
  unitPrice: number;
  priceText: string;
  atCost: boolean;
  taxRate: number;
}): RateLike => ({
  code: r.code,
  name: r.name,
  description: r.description,
  wmsConcept: r.wmsConcept,
  unit: r.unit,
  unitPrice: r.unitPrice,
  priceText: r.priceText,
  atCost: r.atCost,
  taxRate: r.taxRate,
});

/** Calcula la factura propuesta para una importación (tarifas del cliente + tarifario estándar). */
export async function previewImport(imp: { payload: string; clientId: number | null }) {
  const st = statementOf(imp);
  const [settings, clientRates, std] = await Promise.all([
    getSettings(),
    imp.clientId ? prisma.clientRate.findMany({ where: { clientId: imp.clientId, active: true }, orderBy: { sortOrder: "asc" } }) : [],
    prisma.service.findMany({ where: { active: true, NOT: { wmsConcept: "" } } }),
  ]);
  const billing = buildInvoiceLines(
    st,
    clientRates.map(toRate),
    std.map((s) => toRate({ ...s, name: s.name })),
    settings.defaultTaxRate,
  );
  return { statement: st, billing, settings, period: periodText(st.periodFrom, st.periodTo, st.periodLabel) };
}
