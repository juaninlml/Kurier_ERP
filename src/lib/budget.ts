import { prisma } from "./db";
import { round2 } from "./money";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./constants";

export type BudgetRow = {
  type: "INGRESO" | "EGRESO";
  category: string;
  budget: number;
  actual: number;
  ytdBudget: number;
  ytdActual: number;
};

/** Primer y último instante (UTC) de un mes; 1 = enero. */
export function monthRange(year: number, month: number) {
  return { from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)) };
}

/**
 * Presupuesto contra real por categoría: del mes y del año a la fecha (enero → mes elegido).
 * Lo real son los movimientos de contabilidad (con IVA, igual que en Contabilidad).
 * Incluye las categorías fijas y cualquier otra que tenga presupuesto o movimientos.
 */
export async function budgetRows(year: number, month: number): Promise<BudgetRow[]> {
  const m = monthRange(year, month);
  const yStart = new Date(Date.UTC(year, 0, 1));
  const [budgets, monthTx, ytdTx] = await Promise.all([
    prisma.budget.findMany({ where: { year, month: { lte: month } } }),
    prisma.transaction.groupBy({ by: ["type", "category"], where: { date: { gte: m.from, lte: m.to } }, _sum: { amount: true } }),
    prisma.transaction.groupBy({ by: ["type", "category"], where: { date: { gte: yStart, lte: m.to } }, _sum: { amount: true } }),
  ]);
  const key = (type: string, category: string) => `${type}|${category}`;
  const rows = new Map<string, BudgetRow>();
  const row = (type: string, category: string) => {
    const k = key(type, category);
    let r = rows.get(k);
    if (!r) {
      r = { type: type === "INGRESO" ? "INGRESO" : "EGRESO", category, budget: 0, actual: 0, ytdBudget: 0, ytdActual: 0 };
      rows.set(k, r);
    }
    return r;
  };
  INCOME_CATEGORIES.forEach((c) => row("INGRESO", c));
  EXPENSE_CATEGORIES.forEach((c) => row("EGRESO", c));
  for (const b of budgets) {
    const r = row(b.type, b.category);
    r.ytdBudget += b.amount;
    if (b.month === month) r.budget += b.amount;
  }
  for (const t of monthTx) row(t.type, t.category).actual += t._sum.amount ?? 0;
  for (const t of ytdTx) row(t.type, t.category).ytdActual += t._sum.amount ?? 0;
  return [...rows.values()].map((r) => ({
    ...r,
    budget: round2(r.budget),
    actual: round2(r.actual),
    ytdBudget: round2(r.ytdBudget),
    ytdActual: round2(r.ytdActual),
  }));
}
