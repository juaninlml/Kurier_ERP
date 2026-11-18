import { prisma } from "./db";
import { getSettings } from "./settings";

/** Datos comunes para el editor de cotizaciones/facturas. */
export async function editorData() {
  const [clients, services, settings] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.service.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true, description: true, unit: true, unitPrice: true, taxRate: true },
      orderBy: { code: "asc" },
    }),
    getSettings(),
  ]);
  return { clients, services, settings };
}

export const itemsForEditor = (
  items: { code: string; description: string; unit: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number }[],
) =>
  items.map((i) => ({
    code: i.code,
    description: i.description,
    unit: i.unit,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discountPct: i.discountPct,
    taxRate: i.taxRate,
  }));
