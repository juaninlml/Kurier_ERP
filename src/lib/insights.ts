import { prisma } from "./db";
import { round2 } from "./money";

// Series y agregados para las gráficas del ERP (inicio, reportes, nómina).

const DAY_MS = 86_400_000;

/** Nombre visible de cada tramo de antigüedad de saldos (ver AGING_BUCKETS). */
export const AGING_LABEL: Record<string, string> = {
  corriente: "Al corriente",
  "1-30": "1–30 días",
  "31-60": "31–60 días",
  "61-90": "61–90 días",
  "90+": "Más de 90 días",
};

export type FlowPoint = { key: string; label: string; full: string; income: number; expense: number };

/**
 * Ingresos y egresos agrupados por día (rangos de hasta 45 días) o por mes.
 * Las fechas de los movimientos se guardan a mediodía UTC, así que se agrupa en UTC.
 */
export async function flowSeries(from: Date, to: Date, locale = "es-MX"): Promise<{ points: FlowPoint[]; unit: "day" | "month" }> {
  const txs = await prisma.transaction.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, type: true, amount: true } });
  const unit = (to.getTime() - from.getTime()) / DAY_MS <= 45 ? "day" : "month";
  const keyOf = (d: Date) => (unit === "day" ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7));
  const points: FlowPoint[] = [];
  const index = new Map<string, FlowPoint>();
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), unit === "day" ? from.getUTCDate() : 1, 12));
  while (cursor <= to && points.length < 400) {
    const key = keyOf(cursor);
    const p: FlowPoint =
      unit === "day"
        ? {
            key,
            label: String(cursor.getUTCDate()),
            full: cursor.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
            income: 0,
            expense: 0,
          }
        : {
            key,
            label: cursor.toLocaleDateString(locale, { month: "short", timeZone: "UTC" }).replace(".", ""),
            full: cursor.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
            income: 0,
            expense: 0,
          };
    points.push(p);
    index.set(key, p);
    if (unit === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const t of txs) {
    const p = index.get(keyOf(t.date));
    if (!p) continue;
    if (t.type === "INGRESO") p.income += t.amount;
    else p.expense += t.amount;
  }
  for (const p of points) {
    p.income = round2(p.income);
    p.expense = round2(p.expense);
  }
  return { points, unit };
}

/** Últimos `months` meses hasta el mes en curso (incluido). */
export function lastMonthsRange(months = 12, now = new Date()) {
  return {
    from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)),
    to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
  };
}

/** Clientes con mayor facturación (sin canceladas) en el rango. */
export async function topClients(from: Date, to: Date, take = 6) {
  const groups = await prisma.invoice.groupBy({
    by: ["clientId"],
    where: { issueDate: { gte: from, lte: to }, status: { not: "CANCELADA" } },
    _sum: { total: true },
    _count: { _all: true },
    orderBy: { _sum: { total: "desc" } },
    take,
  });
  const clients = await prisma.client.findMany({ where: { id: { in: groups.map((g) => g.clientId) } }, select: { id: true, name: true } });
  const name = new Map(clients.map((c) => [c.id, c.name]));
  return groups.map((g) => ({ id: g.clientId, name: name.get(g.clientId) ?? "—", total: round2(g._sum.total ?? 0), count: g._count._all }));
}

/** Cotizaciones agrupadas por estado (importe y número). */
export async function quotePipeline() {
  const groups = await prisma.quote.groupBy({ by: ["status"], _sum: { total: true }, _count: { _all: true } });
  return Object.fromEntries(groups.map((g) => [g.status, { total: round2(g._sum.total ?? 0), count: g._count._all }])) as Record<
    string,
    { total: number; count: number } | undefined
  >;
}

export type ActivityKind = "factura" | "cotizacion" | "pago" | "movimiento" | "nomina" | "cliente";
export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  at: Date;
  title: string;
  detail: string;
  amount?: number;
  sign?: 1 | -1;
  href: string;
};

/** Registros recientes de todo el sistema, del más nuevo al más viejo. */
export async function recentActivity(take = 10): Promise<ActivityItem[]> {
  const [invoices, quotes, payments, txs, runs, clients] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, folio: true, total: true, createdAt: true, client: { select: { name: true } } },
    }),
    prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, folio: true, total: true, createdAt: true, prospectName: true, client: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, amount: true, createdAt: true, method: true, invoice: { select: { id: true, folio: true, client: { select: { name: true } } } } },
    }),
    prisma.transaction.findMany({
      where: { paymentId: null },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, type: true, category: true, description: true, amount: true, createdAt: true },
    }),
    prisma.payrollRun.findMany({
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, status: true, total: true, periodStart: true, periodEnd: true, updatedAt: true },
    }),
    prisma.client.findMany({ orderBy: { createdAt: "desc" }, take: 4, select: { id: true, name: true, createdAt: true } }),
  ]);
  const items: ActivityItem[] = [
    ...invoices.map((i) => ({
      id: `f${i.id}`,
      kind: "factura" as const,
      at: i.createdAt,
      title: i.folio,
      detail: i.client.name,
      amount: i.total,
      href: `/facturas/${i.id}`,
    })),
    ...quotes.map((q) => ({
      id: `c${q.id}`,
      kind: "cotizacion" as const,
      at: q.createdAt,
      title: q.folio,
      detail: q.client?.name ?? q.prospectName ?? "",
      amount: q.total,
      href: `/cotizaciones/${q.id}`,
    })),
    ...payments.map((p) => ({
      id: `p${p.id}`,
      kind: "pago" as const,
      at: p.createdAt,
      title: p.invoice.folio,
      detail: `${p.invoice.client.name} · ${p.method}`,
      amount: p.amount,
      sign: 1 as const,
      href: `/facturas/${p.invoice.id}`,
    })),
    ...txs.map((t) => ({
      id: `m${t.id}`,
      kind: "movimiento" as const,
      at: t.createdAt,
      title: t.description || t.category,
      detail: t.category,
      amount: t.amount,
      sign: (t.type === "INGRESO" ? 1 : -1) as 1 | -1,
      href: `/contabilidad/movimientos/${t.id}`,
    })),
    ...runs.map((r) => ({
      id: `n${r.id}`,
      kind: "nomina" as const,
      at: r.updatedAt,
      title: r.status,
      detail: `${r.periodStart.toISOString()}|${r.periodEnd.toISOString()}`,
      amount: r.total,
      sign: (r.status === "PAGADA" ? -1 : undefined) as -1 | undefined,
      href: `/nomina/semanas/${r.id}`,
    })),
    ...clients.map((c) => ({ id: `k${c.id}`, kind: "cliente" as const, at: c.createdAt, title: c.name, detail: "", href: `/clientes/${c.id}` })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}

/** Registros capturados por día (facturas, cotizaciones, pagos y movimientos) en las últimas `weeks` semanas, de lunes a domingo. */
export async function activityByDay(weeks = 13, tz = "America/Mexico_City", now = new Date()) {
  const dayOf = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: tz });
  const today = dayOf(now);
  const t = new Date(`${today}T12:00:00Z`);
  const dow = (t.getUTCDay() + 6) % 7;
  const start = new Date(t.getTime() - (dow + (weeks - 1) * 7) * DAY_MS);
  const where = { createdAt: { gte: new Date(start.getTime() - DAY_MS) } };
  const select = { createdAt: true } as const;
  const [a, b, c, d] = await Promise.all([
    prisma.invoice.findMany({ where, select }),
    prisma.quote.findMany({ where, select }),
    prisma.payment.findMany({ where, select }),
    prisma.transaction.findMany({ where: { ...where, paymentId: null }, select }),
  ]);
  const counts = new Map<string, number>();
  for (const r of [...a, ...b, ...c, ...d]) {
    const k = dayOf(r.createdAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    return { date, count: counts.get(date) ?? 0, future: date > today };
  });
  return { days, total: days.reduce((s, x) => s + x.count, 0) };
}

/** Variación porcentual contra un periodo anterior; null si no hay base. */
export const pctChange = (current: number, previous: number) => (previous > 0 ? round2(((current - previous) / previous) * 100) : null);
