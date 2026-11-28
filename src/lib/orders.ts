import { prisma } from "./db";
import { addDaysStr, localParts, mondayOf } from "./attendance";
import { requestLocale } from "./request-lang";

/*
 * Órdenes diarias: paquetes capturados a mano por cliente y oleada.
 * Las fechas son cadenas yyyy-mm-dd en la zona horaria de la empresa.
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function companyToday() {
  const s = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true } });
  return localParts(new Date(), s?.timezone || "America/Mexico_City").date;
}

export const monthStartOf = (d: string) => `${d.slice(0, 7)}-01`;
export const monthEndOf = (d: string) => {
  const [y, m] = d.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${d.slice(0, 7)}-${String(last).padStart(2, "0")}`;
};
export const weekOf = (d: string) => {
  const from = mondayOf(d);
  return { from, to: addDaysStr(from, 6) };
};
export const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d);
  return out;
};

/*
 * Fechas de órdenes. En pantalla salen en el idioma del usuario (requestLocale); los PDFs y los textos
 * que se guardan en documentos (periodo de la factura) pasan "es-MX" explícitamente.
 */
const fmt = (d: string, o: Intl.DateTimeFormatOptions, locale: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { ...o, timeZone: "UTC" });
export const dayShort = (d: string, locale = requestLocale()) => fmt(d, { weekday: "short", day: "numeric", month: "short" }, locale);
export const dayLong = (d: string, locale = requestLocale()) => fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, locale);
export const monthName = (d: string, locale = requestLocale()) => fmt(d, { month: "long", year: "numeric" }, locale);

/** "16 al 22 de noviembre de 2026" · "28 de octubre al 3 de noviembre de 2026" */
export function rangeLabel(from: string, to: string, locale = requestLocale()) {
  const [fy, fm] = from.split("-");
  const [ty, tm] = to.split("-");
  const end = fmt(to, { day: "numeric", month: "long", year: "numeric" }, locale);
  if (locale.startsWith("zh")) {
    // "2026年11月16日至22日" · "2026年10月28日至11月3日"
    const start = fmt(from, { year: "numeric", month: "long", day: "numeric" }, locale);
    if (fy === ty && fm === tm) return `${start}至${Number(to.slice(8))}日`;
    return `${start}至${fmt(to, fy === ty ? { month: "long", day: "numeric" } : { year: "numeric", month: "long", day: "numeric" }, locale)}`;
  }
  if (!locale.startsWith("es")) {
    // "Nov 16 – 22, 2026" · "Oct 28 – Nov 3, 2026"
    // (Intl con solo día y año da "2026 (day: 22)", por eso el mismo mes se arma a mano)
    const start = fmt(from, fy === ty ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }, locale);
    if (fy === ty && fm === tm) return `${start} – ${Number(to.slice(8))}, ${ty}`;
    return `${start} – ${fmt(to, { month: "short", day: "numeric", year: "numeric" }, locale)}`;
  }
  if (fy === ty && fm === tm) return `${Number(from.slice(8))} al ${end}`;
  if (fy === ty) return `${fmt(from, { day: "numeric", month: "long" }, locale)} al ${end}`;
  return `${fmt(from, { day: "numeric", month: "long", year: "numeric" }, locale)} al ${end}`;
}

type RateSource = { orderRate: number; rates: { name: string; wmsConcept: string; unitPrice: number; active: boolean; atCost: boolean }[] };

/**
 * Tarifa por paquete del servicio logístico: la que se capturó en Órdenes diarias o,
 * si no hay, la tarifa negociada del cliente que corresponde (servicio logístico, pedido u orden).
 */
export function orderRateOf(c: RateSource): { rate: number; source: "manual" | "tarifa" | "none"; label: string } {
  if (c.orderRate > 0) return { rate: c.orderRate, source: "manual", label: "Tarifa capturada" };
  const pick = (re: RegExp) => c.rates.find((r) => r.active && !r.atCost && r.unitPrice > 0 && (re.test(r.name) || re.test(r.wmsConcept)));
  const r = pick(/servicio\s+log/i) ?? pick(/pedido|orden|paquete/i);
  return r ? { rate: r.unitPrice, source: "tarifa", label: `Tarifa negociada: ${r.name}` } : { rate: 0, source: "none", label: "Sin tarifa" };
}

export type OrderRow = { workDate: string; clientId: number; waveId: number; quantity: number };

/** Totales por día (de todos los clientes o de uno). */
export function totalsByDay(orders: OrderRow[], clientId?: number) {
  const m = new Map<string, number>();
  for (const o of orders) if (clientId === undefined || o.clientId === clientId) m.set(o.workDate, (m.get(o.workDate) ?? 0) + o.quantity);
  return m;
}

/** Suma de un cliente en un rango (inclusive). */
export const sumRange = (orders: OrderRow[], from: string, to: string, clientId?: number) =>
  orders.reduce((a, o) => (o.workDate >= from && o.workDate <= to && (clientId === undefined || o.clientId === clientId) ? a + o.quantity : a), 0);

/** Días con al menos una orden capturada (de cualquier cliente) en el rango: los días operados. */
export const operatedDays = (orders: OrderRow[], from: string, to: string) =>
  new Set(orders.filter((o) => o.quantity > 0 && o.workDate >= from && o.workDate <= to).map((o) => o.workDate)).size;

/** Semanas (lunes a domingo) que tocan el rango hasta `upTo`, contadas por días operados. */
export const operatedWeeks = (orders: OrderRow[], from: string, to: string) =>
  new Set(orders.filter((o) => o.quantity > 0 && o.workDate >= from && o.workDate <= to).map((o) => mondayOf(o.workDate))).size;

export async function activeWaves() {
  return prisma.orderWave.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

/** Datos para el PDF de resumen y la factura: órdenes de un cliente en un periodo. */
export async function clientOrdersSummary(clientId: number, from: string, to: string) {
  const [client, waves, orders, materials, supplies] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, include: { rates: true, brand: true } }),
    prisma.orderWave.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.dailyOrder.findMany({ where: { clientId, workDate: { gte: from, lte: to }, quantity: { gt: 0 } }, orderBy: { workDate: "asc" } }),
    prisma.packMaterial.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.dailySupply.groupBy({ by: ["materialId"], where: { clientId, workDate: { gte: from, lte: to }, quantity: { gt: 0 } }, _sum: { quantity: true } }),
  ]);
  if (!client) return null;
  // Columnas: las oleadas activas más las inactivas que tengan órdenes en el periodo.
  const used = new Set(orders.map((o) => o.waveId));
  const cols = waves.filter((w) => w.active || used.has(w.id));
  const days = daysBetween(from, to)
    .map((d) => {
      const byWave = Object.fromEntries(cols.map((w) => [w.id, 0])) as Record<number, number>;
      for (const o of orders) if (o.workDate === d) byWave[o.waveId] = (byWave[o.waveId] ?? 0) + o.quantity;
      return { date: d, byWave, total: Object.values(byWave).reduce((a, b) => a + b, 0) };
    })
    .filter((d) => d.total > 0);
  const byWave = cols.map((w) => ({ id: w.id, name: w.name, total: orders.filter((o) => o.waveId === w.id).reduce((a, o) => a + o.quantity, 0) }));
  const total = byWave.reduce((a, w) => a + w.total, 0);
  const rate = orderRateOf(client);
  // Insumos de empaque del periodo (por material)
  const used2 = new Map(supplies.map((x) => [x.materialId, x._sum.quantity ?? 0]));
  const byMaterial = materials.filter((m) => used2.get(m.id)).map((m) => ({ id: m.id, name: m.name, size: m.size, noSupply: m.noSupply, unitPrice: m.noSupply ? 0 : m.unitPrice, total: used2.get(m.id)! }));
  // Promedios con semanas de lunes a sábado (hasta hoy si el periodo sigue en curso).
  const today = await companyToday();
  const weekly = weeklyAverages(orders, weekSegments(from, to, today < to ? today : to));
  return { client, waves: cols, days, byWave, total, rate, from, to, byMaterial, weekly };
}

/*
 * Promedios por semanas de lunes a sábado (el domingo no se labora). Un mes se parte en
 * tramos semanales; la primera y la última semana pueden quedar cortadas por el cambio de mes.
 *   promedio diario de la semana = paquetes del tramo ÷ días lunes–sábado del tramo (transcurridos)
 *   promedio diario del mes      = promedio de los promedios diarios de cada semana
 *   promedio semanal del mes     = promedio de los totales de cada semana
 * Si hubo órdenes en domingo, suman al total de su semana pero no cuentan como día.
 */

export type WeekSegment = { from: string; to: string; workdays: number };

/** Días lunes–sábado entre dos fechas (inclusive), sin pasar de `upTo`. */
export function workdaysBetween(from: string, to: string, upTo = to) {
  const end = upTo < to ? upTo : to;
  let n = 0;
  for (let d = from; d <= end; d = addDaysStr(d, 1)) if (new Date(`${d}T12:00:00Z`).getUTCDay() !== 0) n++;
  return n;
}

/** Tramos semanales (lunes a domingo) del rango, cortados en los extremos. */
export function weekSegments(from: string, to: string, upTo = to): WeekSegment[] {
  const out: WeekSegment[] = [];
  for (let start = from; start <= to; ) {
    const sunday = addDaysStr(mondayOf(start), 6);
    const end = sunday < to ? sunday : to;
    out.push({ from: start, to: end, workdays: workdaysBetween(start, end, upTo) });
    start = addDaysStr(end, 1);
  }
  return out;
}

/** Totales y promedio diario de cada tramo, y los promedios del periodo calculados a partir de ellos. */
export function weeklyAverages(orders: OrderRow[], segments: WeekSegment[], clientId?: number) {
  const weeks = segments.map((s) => {
    const total = sumRange(orders, s.from, s.to, clientId);
    return { ...s, total, dailyAvg: s.workdays ? total / s.workdays : 0 };
  });
  const counted = weeks.filter((w) => w.workdays > 0);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return {
    weeks,
    /** Semanas que ya tienen días lunes–sábado transcurridos. */
    counted: counted.length,
    dailyAvg: mean(counted.map((w) => w.dailyAvg)),
    weeklyAvg: mean(counted.map((w) => w.total)),
  };
}
