import { prisma } from "./db";
import { round2 } from "./money";

/*
 * Economía de los insumos de empaque: cada material tiene nuestro costo y el precio al que se
 * vende al cliente (sin IVA). Costo consumido = piezas × costo; venta = piezas × precio.
 * Un material con precio 0 va incluido en el servicio (solo genera costo).
 */

export type MaterialMoney = { unitCost: number; unitPrice: number; noSupply: boolean };

export const supplyCost = (qty: number, m: MaterialMoney) => (m.noSupply ? 0 : qty * m.unitCost);
export const supplySale = (qty: number, m: MaterialMoney) => (m.noSupply ? 0 : qty * m.unitPrice);

/** Totales por material (y opcionalmente de un cliente) en un rango yyyy-mm-dd. */
export async function suppliesByMaterial(from: string, to: string, clientId?: number) {
  const [materials, rows] = await Promise.all([
    prisma.packMaterial.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.dailySupply.groupBy({
      by: ["materialId"],
      where: { workDate: { gte: from, lte: to }, quantity: { gt: 0 }, ...(clientId ? { clientId } : {}) },
      _sum: { quantity: true },
    }),
  ]);
  const qty = new Map(rows.map((r) => [r.materialId, r._sum.quantity ?? 0]));
  const list = materials
    .filter((m) => qty.get(m.id))
    .map((m) => {
      const q = qty.get(m.id)!;
      return { id: m.id, name: m.name, size: m.size, noSupply: m.noSupply, unitCost: m.unitCost, unitPrice: m.unitPrice, qty: q, cost: round2(supplyCost(q, m)), sale: round2(supplySale(q, m)) };
    });
  const pieces = list.filter((m) => !m.noSupply).reduce((a, m) => a + m.qty, 0);
  const cost = round2(list.reduce((a, m) => a + m.cost, 0));
  const sale = round2(list.reduce((a, m) => a + m.sale, 0));
  return { list, pieces, cost, sale, margin: round2(sale - cost) };
}

/** Margen en % sobre la venta (null si no hay venta). */
export const marginPct = (sale: number, cost: number) => (sale > 0 ? Math.round(((sale - cost) / sale) * 100) : null);
