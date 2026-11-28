import { prisma } from "./db";
import { addDaysStr } from "./attendance";
import { round2 } from "./money";

/*
 * Inventario de insumos de empaque.
 * - Un CONTEO físico fija la existencia al cierre de ese día.
 * - Existencia = último conteo + entradas posteriores − piezas capturadas en "Insumos de empaque" después del conteo.
 * - Sin conteo: se cuenta desde la primera entrada (las piezas usadas antes no restan, así el historial viejo
 *   no deja existencias negativas).
 * - Los materiales "Sin insumo" no llevan inventario.
 */

export const MOVE_KINDS = ["ENTRADA", "CONTEO"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];

/** Semanas de consumo para el promedio (lunes a sábado = 6 días hábiles por semana). */
const AVG_WEEKS = 4;
const WORKDAYS = AVG_WEEKS * 6;

export type StockStatus = "untracked" | "out" | "low" | "ok";

export async function inventory(today: string) {
  const [materials, moves] = await Promise.all([
    prisma.packMaterial.findMany({ where: { noSupply: false }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { id: "asc" }] }),
    prisma.stockMove.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
  ]);

  // Desde dónde cuenta el consumo de cada material
  const base = new Map<number, { qty: number; since: string; inclusive: boolean; countDate: string | null; countAt: Date | null }>();
  for (const m of materials) {
    const mine = moves.filter((x) => x.materialId === m.id);
    const count = mine.filter((x) => x.kind === "CONTEO").at(-1);
    const firstEntry = mine.find((x) => x.kind === "ENTRADA");
    if (count) base.set(m.id, { qty: count.quantity, since: count.date, inclusive: false, countDate: count.date, countAt: count.createdAt });
    else if (firstEntry) base.set(m.id, { qty: 0, since: firstEntry.date, inclusive: true, countDate: null, countAt: null });
  }

  const oldest = [...base.values()].reduce((a, b) => (b.since < a ? b.since : a), today);
  const avgFrom = addDaysStr(today, -AVG_WEEKS * 7 + 1);
  const used = await prisma.dailySupply.groupBy({
    by: ["materialId", "workDate"],
    where: { workDate: { gte: oldest < avgFrom ? oldest : avgFrom }, quantity: { gt: 0 } },
    _sum: { quantity: true },
  });

  const rows = materials.map((m) => {
    const b = base.get(m.id);
    const mine = used.filter((u) => u.materialId === m.id);
    const recent = mine.filter((u) => u.workDate >= avgFrom && u.workDate <= today).reduce((a, u) => a + (u._sum.quantity ?? 0), 0);
    const perDay = recent / WORKDAYS;
    if (!b) {
      return { ...m, tracked: false as const, stock: null, value: 0, perDay, days: null, status: "untracked" as StockStatus, lastCount: null, lastEntry: null };
    }
    const after = (date: string) => (b.inclusive ? date >= b.since : date > b.since);
    const entries = moves
      .filter((x) => x.materialId === m.id && x.kind === "ENTRADA")
      // Entradas del mismo día del conteo: solo las capturadas después de él
      .filter((x) => after(x.date) || (!b.inclusive && x.date === b.since && b.countAt && x.createdAt > b.countAt));
    const consumed = mine.filter((u) => after(u.workDate)).reduce((a, u) => a + (u._sum.quantity ?? 0), 0);
    const stock = b.qty + entries.reduce((a, x) => a + x.quantity, 0) - consumed;
    const status: StockStatus = stock <= 0 ? "out" : m.minStock > 0 && stock <= m.minStock ? "low" : "ok";
    const lastEntry = moves.filter((x) => x.materialId === m.id && x.kind === "ENTRADA").at(-1) ?? null;
    return {
      ...m,
      tracked: true as const,
      stock,
      value: round2(Math.max(0, stock) * m.unitCost),
      perDay,
      days: perDay > 0 ? Math.max(0, Math.floor(stock / perDay)) : null,
      status,
      lastCount: b.countDate,
      lastEntry: lastEntry ? { date: lastEntry.date, quantity: lastEntry.quantity } : null,
    };
  });

  const alerts = rows.filter((r) => r.active && (r.status === "out" || r.status === "low"));
  return {
    rows,
    alerts,
    totals: {
      tracked: rows.filter((r) => r.tracked).length,
      value: round2(rows.reduce((a, r) => a + r.value, 0)),
      out: alerts.filter((r) => r.status === "out").length,
      low: alerts.filter((r) => r.status === "low").length,
    },
  };
}

export type InventoryRow = Awaited<ReturnType<typeof inventory>>["rows"][number];

/** Solo las alertas (para Inicio y la captura de insumos). */
export async function stockAlerts(today: string) {
  return (await inventory(today)).alerts.map((r) => ({ id: r.id, name: r.name, stock: r.stock ?? 0, minStock: r.minStock, days: r.days, status: r.status as "out" | "low" }));
}
