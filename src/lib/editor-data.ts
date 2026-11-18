import { prisma } from "./db";
import { getSettings } from "./settings";
import type { LineInput } from "./totals";

/** Datos comunes para el editor de cotizaciones/facturas. */
export async function editorData() {
  const [clients, services, sections, settings] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, description: true, unit: true, unitPrice: true, taxRate: true, section: true, priceText: true, atCost: true, sortOrder: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    prisma.serviceSection.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  // Ordena los servicios según el orden de las secciones del tarifario.
  const rank = new Map(sections.map((s, i) => [s.name, i]));
  services.sort((a, b) => (rank.get(a.section) ?? 99) - (rank.get(b.section) ?? 99) || a.sortOrder - b.sortOrder);
  return { clients, services, settings };
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
