import { prisma } from "./db";
import { getSettings } from "./settings";
import type { LineInput } from "./totals";
import { brandOptions } from "./brands";

/** Datos comunes para el editor de cotizaciones/facturas. */
export async function editorData() {
  const [clients, services, sections, settings, rates, brands] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true, brandId: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, description: true, unit: true, unitPrice: true, taxRate: true, section: true, priceText: true, atCost: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    prisma.serviceSection.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
    prisma.clientRate.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    brandOptions(),
  ]);
  // Ordena los servicios según el orden de las secciones del tarifario.
  const rank = new Map(sections.map((s, i) => [s.name, i]));
  services.sort((a, b) => (rank.get(a.section) ?? 99) - (rank.get(b.section) ?? 99) || a.sortOrder - b.sortOrder);
  // Tarifas negociadas por cliente, con la misma forma que los servicios del tarifario.
  const clientRates: Record<number, typeof services> = {};
  for (const r of rates) {
    (clientRates[r.clientId] ??= []).push({
      id: -r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      unit: r.unit,
      unitPrice: r.unitPrice,
      taxRate: r.taxRate,
      section: "Tarifas del cliente",
      priceText: r.priceText,
      atCost: r.atCost,
      sortOrder: r.sortOrder,
    });
  }
  return { clients, services, clientRates, settings, brands };
}

type ItemRow = {
  code: string;
  description: string;
  detail: string;
  section: string;
  priceText: string;
  atCost: boolean;
  scales?: boolean;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  amount: number;
};

export const itemsForEditor = (items: ItemRow[]): LineInput[] =>
  items.map((i) => ({
    code: i.code,
    description: i.description,
    detail: i.detail,
    section: i.section,
    priceText: i.priceText,
    atCost: i.atCost,
    scales: Boolean(i.scales),
    unit: i.unit,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discountPct: i.discountPct,
    taxRate: i.taxRate,
    amount: i.amount,
  }));

/** Filas por defecto del "Perfil de la operación cotizada". */
export const DEFAULT_PROFILE = [
  { label: "Fulfillment por pedido", value: "" },
  { label: "Composición del pedido", value: "" },
  { label: "Volumen mensual", value: "Por confirmar." },
];

export function parseProfileJson(json: string): { label: string; value: string }[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((r) => r && typeof r.label === "string") : [];
  } catch {
    return [];
  }
}

/** Siguiente folio de una serie: sube el último número conservando ceros y sufijo ("CUF-009" → "CUF-010"). */
export function incrementFolio(folio: string) {
  const m = folio.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return "";
  const n = String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return `${m[1]}${n}${m[3]}`;
}

/**
 * Folio sugerido por cliente: si su última factura usa una serie propia (no la automática de la empresa
 * o de una marca), se sugiere el siguiente número de esa serie. Sin serie propia: automático.
 */
export async function invoiceFolioSuggestions() {
  const [settings, brands, invoices] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: 1 }, select: { invoicePrefix: true } }),
    prisma.brand.findMany({ select: { invoicePrefix: true } }),
    prisma.invoice.findMany({ orderBy: [{ issueDate: "desc" }, { id: "desc" }], select: { clientId: true, folio: true } }),
  ]);
  const auto = new Set([settings?.invoicePrefix || "FAC", ...brands.map((b) => b.invoicePrefix)].filter(Boolean).map((p) => p.toUpperCase()));
  const isAuto = (f: string) => {
    const m = f.match(/^(.+)-\d{5}$/);
    return !!m && auto.has(m[1].toUpperCase());
  };
  const out: Record<number, string> = {};
  const used = new Set(invoices.map((i) => i.folio));
  for (const inv of invoices) {
    if (inv.clientId in out || isAuto(inv.folio)) continue;
    let next = incrementFolio(inv.folio);
    while (next && used.has(next)) next = incrementFolio(next);
    if (next) out[inv.clientId] = next;
  }
  return out;
}
