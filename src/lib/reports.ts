import { prisma } from "./db";
import { round2 } from "./money";

export type CategoryRow = { category: string; amount: number; tax: number; count: number };

export type PartyRow = { key: string; name: string; href?: string; amount: number; count: number };

export async function incomeStatement(from: Date, to: Date) {
  const txs = await prisma.transaction.findMany({
    where: { date: { gte: from, lte: to } },
    // Solo las columnas que se suman (el estado de resultados puede abarcar miles de movimientos)
    select: { type: true, category: true, amount: true, tax: true, client: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } },
  });
  /** Ingresos por cliente y egresos por proveedor; lo que no tiene contraparte va en "Sin cliente"/"Sin proveedor". */
  const byParty = (type: "INGRESO" | "EGRESO") => {
    const map = new Map<string, PartyRow>();
    for (const t of txs.filter((x) => x.type === type)) {
      const p = type === "INGRESO" ? t.client : t.supplier;
      const key = p ? String(p.id) : "none";
      const r = map.get(key) ?? {
        key,
        name: p?.name ?? (type === "INGRESO" ? "Sin cliente" : "Sin proveedor"),
        href: p ? (type === "INGRESO" ? `/clientes/${p.id}` : `/proveedores/${p.id}`) : undefined,
        amount: 0,
        count: 0,
      };
      r.amount += t.amount;
      r.count += 1;
      map.set(key, r);
    }
    return [...map.values()].map((r) => ({ ...r, amount: round2(r.amount) })).sort((a, b) => b.amount - a.amount);
  };
  const group = (type: string) => {
    const map = new Map<string, CategoryRow>();
    for (const t of txs.filter((x) => x.type === type)) {
      const r = map.get(t.category) ?? { category: t.category, amount: 0, tax: 0, count: 0 };
      r.amount += t.amount;
      r.tax += t.tax;
      r.count += 1;
      map.set(t.category, r);
    }
    return [...map.values()]
      .map((r) => ({ ...r, amount: round2(r.amount), tax: round2(r.tax) }))
      .sort((a, b) => b.amount - a.amount);
  };
  const income = group("INGRESO");
  const expense = group("EGRESO");
  const sum = (rows: CategoryRow[], k: "amount" | "tax") => round2(rows.reduce((a, r) => a + r[k], 0));
  const incomeTotal = sum(income, "amount");
  const expenseTotal = sum(expense, "amount");
  const incomeTax = sum(income, "tax");
  const expenseTax = sum(expense, "tax");
  return {
    income,
    expense,
    incomeByClient: byParty("INGRESO"),
    expenseBySupplier: byParty("EGRESO"),
    incomeTotal,
    expenseTotal,
    incomeTax,
    expenseTax,
    /** Utilidad antes de impuestos sobre montos sin IVA */
    netBeforeTax: round2(incomeTotal - incomeTax - (expenseTotal - expenseTax)),
    /** Flujo neto de efectivo (con IVA) */
    cashFlow: round2(incomeTotal - expenseTotal),
    ivaBalance: round2(incomeTax - expenseTax),
    count: txs.length,
  };
}

export type AgingBucket = "corriente" | "1-30" | "31-60" | "61-90" | "90+";
export const AGING_BUCKETS: AgingBucket[] = ["corriente", "1-30", "31-60", "61-90", "90+"];

export async function receivables(asOf = new Date()) {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["PENDIENTE", "PARCIAL"] } },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });
  const rows = invoices.map((inv) => {
    const balance = round2(inv.total - inv.paidTotal);
    const days = Math.floor((asOf.getTime() - inv.dueDate.getTime()) / 86_400_000);
    const bucket: AgingBucket = days <= 0 ? "corriente" : days <= 30 ? "1-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
    return { ...inv, balance, daysOverdue: Math.max(0, days), bucket };
  });
  const byBucket = Object.fromEntries(AGING_BUCKETS.map((b) => [b, round2(rows.filter((r) => r.bucket === b).reduce((a, r) => a + r.balance, 0))])) as Record<AgingBucket, number>;
  return { rows, byBucket, total: round2(rows.reduce((a, r) => a + r.balance, 0)) };
}

/** Rango por defecto: mes en curso. Acepta yyyy-mm-dd. */
export function parseRange(from?: string, to?: string) {
  const now = new Date();
  const f = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const t = to ? new Date(`${to}T23:59:59.999Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from: f, to: t };
}
