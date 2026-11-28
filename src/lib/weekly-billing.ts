import { prisma } from "./db";
import { clientOrdersSummary, rangeLabel, weekOf } from "./orders";
import { addDaysStr } from "./attendance";
import { suppliesByMaterial } from "./supplies";
import { computeLines } from "./totals";
import { round2 } from "./money";

/*
 * Factura semanal del servicio logístico a partir de Órdenes diarias e Insumos de empaque.
 * La usan "Nueva factura" (?ordenes=…&semana=…), la pantalla Facturación semanal y la emisión en lote,
 * para que las tres calculen exactamente lo mismo. Los textos que se guardan en la factura van en español.
 */

type Settings = { defaultTaxRate: number };

export type WeeklyLine = { description: string; detail: string; section?: string; unit: string; quantity: number; unitPrice: number; taxRate: number };

/** Propuesta de factura de un cliente para la semana que empieza en `weekFrom` (lunes). null = no hay órdenes. */
export async function weeklyDraft(clientId: number, weekFrom: string, settings: Settings) {
  const week = weekOf(weekFrom);
  const [sum, sup] = await Promise.all([clientOrdersSummary(clientId, week.from, week.to), suppliesByMaterial(week.from, week.to, clientId)]);
  if (!sum || sum.total <= 0) return null;
  // Todos los insumos consumidos en la semana (menos «Sin insumo»). Precio: el de la tarifa del cliente
  // con el mismo nombre del material, si la tiene; si no, el precio de venta del material.
  const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^material de empaque:\s*/i, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
  const clientPrice = (name: string) => sum.client.rates.find((r) => r.active && !r.atCost && norm(r.name) === norm(name))?.unitPrice;
  const supplyLines: WeeklyLine[] = sup.list
    .filter((m) => !m.noSupply)
    .map((m) => ({
      description: `Material de empaque: ${m.name}`,
      detail: m.size ? `Medidas ${m.size.replace(/\*/g, "×")} cm` : "",
      section: "Material de empaque",
      unit: "Pieza",
      quantity: m.qty,
      unitPrice: clientPrice(m.name) ?? m.unitPrice,
      taxRate: settings.defaultTaxRate,
    }));
  const period = rangeLabel(week.from, week.to, "es-MX");
  const breakdown = sum.byWave.filter((w) => w.total > 0).map((w) => `${w.name}: ${w.total}`).join(" · ");
  const items: WeeklyLine[] = [
    {
      description: "Servicio logístico",
      detail: `Paquetes procesados del ${period}${breakdown ? ` (${breakdown})` : ""}`,
      unit: "Paquete",
      quantity: sum.total,
      unitPrice: sum.rate.rate,
      taxRate: settings.defaultTaxRate,
    },
    ...supplyLines,
  ];
  const totals = computeLines(items.filter((i) => i.quantity > 0));
  return {
    client: { id: sum.client.id, name: sum.client.name, brandId: sum.client.brandId },
    week,
    ordersWeek: week.from,
    period: `${period} — ciclo semanal`,
    volume: `${sum.total} paquetes en ${sum.days.length} día(s) operado(s)`,
    storage: "No se cobra en este periodo.",
    items,
    packages: sum.total,
    rate: sum.rate,
    supplyLines,
    supplySale: round2(supplyLines.reduce((a, l) => a + l.quantity * l.unitPrice, 0)),
    unpriced: supplyLines.filter((l) => !l.unitPrice).length,
    onlyNoSupply: !supplyLines.length && sup.list.some((m) => m.noSupply),
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
  };
}

export type WeeklyDraft = NonNullable<Awaited<ReturnType<typeof weeklyDraft>>>;

/** ¿Se puede emitir sin revisar? Necesita tarifa por paquete y precio en todos los insumos. */
export const draftIssues = (d: WeeklyDraft) => [...(d.rate.rate > 0 ? [] : ["noRate" as const]), ...(d.unpriced ? ["unpriced" as const] : [])];

/** Todos los clientes con órdenes en la semana: su propuesta y, si ya se facturó, la factura. */
export async function weeklyBoard(weekFrom: string) {
  const week = weekOf(weekFrom);
  const [settings, withOrders, invoiced] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 }, select: { defaultTaxRate: true } }),
    prisma.dailyOrder.groupBy({ by: ["clientId"], where: { workDate: { gte: week.from, lte: week.to }, quantity: { gt: 0 } } }),
    prisma.invoice.findMany({ where: { ordersWeek: week.from, status: { not: "CANCELADA" } }, select: { id: true, folio: true, clientId: true, total: true, status: true } }),
  ]);
  const tax = { defaultTaxRate: settings?.defaultTaxRate ?? 16 };
  const drafts = (await Promise.all(withOrders.map((c) => weeklyDraft(c.clientId, week.from, tax)))).filter((d): d is WeeklyDraft => !!d);
  const byClient = new Map(invoiced.map((i) => [i.clientId, i]));
  const rows = drafts
    .map((d) => {
      const invoice = byClient.get(d.client.id) ?? null;
      const issues = draftIssues(d);
      return { ...d, invoice, issues, ready: !invoice && issues.length === 0 };
    })
    .sort((a, b) => Number(!!a.invoice) - Number(!!b.invoice) || a.client.name.localeCompare(b.client.name, "es"));
  return {
    week,
    rows,
    totals: {
      pending: rows.filter((r) => !r.invoice).length,
      ready: rows.filter((r) => r.ready).length,
      readyTotal: round2(rows.filter((r) => r.ready).reduce((a, r) => a + r.total, 0)),
      invoiced: rows.filter((r) => r.invoice).length,
    },
  };
}

export type WeeklyRow = Awaited<ReturnType<typeof weeklyBoard>>["rows"][number];

/** Semana a facturar por omisión: la última semana completa (la anterior a la actual). */
export const lastWeek = (today: string) => weekOf(addDaysStr(weekOf(today).from, -7)).from;

/** Aviso de Inicio (consulta ligera): clientes con órdenes en la semana que aún no tienen su factura. */
export async function weeklyPending(weekFrom: string) {
  const week = weekOf(weekFrom);
  const [withOrders, invoiced] = await Promise.all([
    prisma.dailyOrder.groupBy({ by: ["clientId"], where: { workDate: { gte: week.from, lte: week.to }, quantity: { gt: 0 } } }),
    prisma.invoice.findMany({ where: { ordersWeek: week.from, status: { not: "CANCELADA" } }, select: { clientId: true } }),
  ]);
  const done = new Set(invoiced.map((i) => i.clientId));
  return { week, pending: withOrders.filter((c) => !done.has(c.clientId)).length };
}
