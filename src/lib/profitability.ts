import { prisma } from "./db";
import { round2 } from "./money";

/** Categorías de egreso que no se reparten como costo operativo. */
// "Material de empaque" ya entra como costo directo (consumo de insumos por cliente);
// "Impuestos" no es un costo de operar a un cliente.
export const NOT_ALLOCATED = ["Material de empaque", "Impuestos"];

export type ProfitRow = {
  clientId: number;
  name: string;
  orders: number;
  revenue: number;
  supplies: number;
  allocated: number;
  profit: number;
  margin: number | null;
  revenuePerOrder: number | null;
  costPerOrder: number | null;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Rentabilidad estimada por cliente en un periodo:
 *   ingreso   = facturado sin IVA (subtotal − descuento) de facturas no canceladas emitidas en el periodo;
 *   insumos   = piezas de empaque que consumió × costo unitario (órdenes diarias → insumos);
 *   operativo = egresos sin IVA del periodo (nómina, renta, paquetería, servicios…; sin empaque ni impuestos)
 *               repartidos según la participación del cliente en las órdenes procesadas
 *               (si no hay órdenes capturadas, según su participación en lo facturado).
 */
export async function profitability(from: Date, to: Date) {
  const [invoices, orders, supplies, expenses, clients] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["clientId"],
      where: { issueDate: { gte: from, lte: to }, status: { not: "CANCELADA" } },
      _sum: { subtotal: true, discount: true },
    }),
    prisma.dailyOrder.groupBy({ by: ["clientId"], where: { workDate: { gte: ymd(from), lte: ymd(to) } }, _sum: { quantity: true } }),
    prisma.dailySupply.findMany({
      where: { workDate: { gte: ymd(from), lte: ymd(to) }, quantity: { gt: 0 }, material: { noSupply: false } },
      select: { clientId: true, quantity: true, material: { select: { unitCost: true } } },
    }),
    prisma.transaction.findMany({
      where: { type: "EGRESO", date: { gte: from, lte: to }, category: { notIn: NOT_ALLOCATED } },
      select: { amount: true, tax: true },
    }),
    prisma.client.findMany({ select: { id: true, name: true } }),
  ]);

  const revenue = new Map(invoices.map((i) => [i.clientId, (i._sum.subtotal ?? 0) - (i._sum.discount ?? 0)]));
  const orderQty = new Map(orders.map((o) => [o.clientId, o._sum.quantity ?? 0]));
  const supplyCost = new Map<number, number>();
  for (const s of supplies) supplyCost.set(s.clientId, (supplyCost.get(s.clientId) ?? 0) + s.quantity * s.material.unitCost);

  const pool = round2(expenses.reduce((a, e) => a + e.amount - e.tax, 0));
  const totalOrders = [...orderQty.values()].reduce((a, b) => a + b, 0);
  const totalRevenue = [...revenue.values()].reduce((a, b) => a + b, 0);
  const basis: "orders" | "revenue" | "none" = totalOrders > 0 ? "orders" : totalRevenue > 0 ? "revenue" : "none";

  const ids = new Set([...revenue.keys(), ...orderQty.keys(), ...supplyCost.keys()]);
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const rows: ProfitRow[] = [...ids].map((id) => {
    const rev = round2(revenue.get(id) ?? 0);
    const ord = orderQty.get(id) ?? 0;
    const sup = round2(supplyCost.get(id) ?? 0);
    const share = basis === "orders" ? ord / totalOrders : basis === "revenue" ? rev / totalRevenue : 0;
    const alloc = round2(pool * share);
    const profit = round2(rev - sup - alloc);
    return {
      clientId: id,
      name: names.get(id) ?? `#${id}`,
      orders: ord,
      revenue: rev,
      supplies: sup,
      allocated: alloc,
      profit,
      margin: rev > 0 ? profit / rev : null,
      revenuePerOrder: ord > 0 ? round2(rev / ord) : null,
      costPerOrder: ord > 0 ? round2((sup + alloc) / ord) : null,
    };
  });
  rows.sort((a, b) => b.profit - a.profit);
  const sum = (k: "revenue" | "supplies" | "allocated" | "profit") => round2(rows.reduce((a, r) => a + r[k], 0));
  // Lo que no se pudo asignar (p. ej. sin órdenes ni facturas de nadie) queda aparte para no esconderlo.
  const unallocated = round2(pool - sum("allocated"));
  return {
    rows,
    pool,
    basis,
    unallocated,
    totals: { revenue: sum("revenue"), supplies: sum("supplies"), allocated: sum("allocated"), profit: sum("profit"), orders: totalOrders },
  };
}
