import { round2 } from "./money";

/**
 * Cálculos de nómina según la Ley Federal del Trabajo (sin ISR, IMSS ni carga patronal).
 * - Vacaciones (art. 76, reforma 2023): 12 días al cumplir el 1er año, +2 por año hasta 20 días al 5º año,
 *   y después +2 cada 5 años (22 del 6º al 10º, 24 del 11º al 15º…).
 * - Prima vacacional (art. 80): 25% del salario de los días de vacaciones.
 * - Aguinaldo (política de Kurier, arriba del mínimo de ley de 15 días): 15 días el primer año, +1 día por
 *   año de antigüedad hasta el 5º año y +2 días por año después, con tope de 30 días. Proporcional al tiempo
 *   trabajado en el año calendario.
 * - Semana: se pagan 6 días; el 7º es de descanso y no se paga (por ahora).
 */
export const AGUINALDO_BASE_DAYS = 15;
export const AGUINALDO_MAX_DAYS = 30;
/** Días que se pagan por semana (el 7º es descanso sin goce, por ahora). */
export const PAID_DAYS_PER_WEEK = 6;

/** Días de aguinaldo según los años de antigüedad cumplidos. 0→15, 1→16 … 5→20, 6→22, 7→24 … 10→30 (tope). */
export function aguinaldoDaysFor(years: number) {
  const y = Math.max(0, Math.floor(years));
  return Math.min(AGUINALDO_MAX_DAYS, AGUINALDO_BASE_DAYS + Math.min(y, 5) + 2 * Math.max(0, y - 5));
}
export const VACATION_PREMIUM = 0.25;
const DAY = 86400000;

/** Días de vacaciones que corresponden al cumplir `years` años de servicio. */
export function vacationDaysFor(years: number) {
  if (years < 1) return 0;
  if (years <= 5) return 10 + years * 2; // 12, 14, 16, 18, 20
  return 20 + Math.ceil((years - 5) / 5) * 2; // 22 (6-10), 24 (11-15)…
}

/** Antigüedad a una fecha: años cumplidos, meses y días restantes, y total de días. */
export function seniority(start: Date, at = new Date()) {
  const totalDays = Math.max(0, Math.floor((at.getTime() - start.getTime()) / DAY));
  let years = at.getUTCFullYear() - start.getUTCFullYear();
  const anniversaryThisYear = new Date(Date.UTC(at.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  if (at < anniversaryThisYear) years--;
  years = Math.max(0, years);
  const lastAnniversary = new Date(Date.UTC(start.getUTCFullYear() + years, start.getUTCMonth(), start.getUTCDate()));
  const nextAnniversary = new Date(Date.UTC(start.getUTCFullYear() + years + 1, start.getUTCMonth(), start.getUTCDate()));
  let months = (at.getUTCFullYear() - lastAnniversary.getUTCFullYear()) * 12 + at.getUTCMonth() - lastAnniversary.getUTCMonth();
  if (at.getUTCDate() < lastAnniversary.getUTCDate()) months--;
  months = Math.max(0, months);
  const monthMark = new Date(Date.UTC(lastAnniversary.getUTCFullYear(), lastAnniversary.getUTCMonth() + months, lastAnniversary.getUTCDate()));
  const days = Math.max(0, Math.floor((at.getTime() - monthMark.getTime()) / DAY));
  return { years, months, days, totalDays, lastAnniversary, nextAnniversary };
}

export function seniorityLabel(s: { years: number; months: number; days: number }) {
  const parts = [
    s.years ? `${s.years} año${s.years === 1 ? "" : "s"}` : "",
    s.months ? `${s.months} mes${s.months === 1 ? "" : "es"}` : "",
    !s.years && !s.months ? `${s.days} día${s.days === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return parts.join(", ") || "Menos de un día";
}

/**
 * Prestaciones de un empleado a una fecha.
 * `vacationTaken`: días de vacaciones ya tomados en el periodo vacacional actual (desde el último aniversario).
 */
export function benefits(e: { startDate: Date; dailySalary: number }, vacationTaken = 0, at = new Date()) {
  const s = seniority(e.startDate, at);
  const daily = e.dailySalary;
  // Vacaciones ganadas en el último aniversario (para disfrutar durante este periodo)
  const vacationEntitled = vacationDaysFor(s.years);
  const vacationAvailable = Math.max(0, vacationEntitled - vacationTaken);
  // Lo que se va acumulando hacia el próximo aniversario (proporcional, útil para finiquito)
  const periodDays = Math.max(1, (s.nextAnniversary.getTime() - s.lastAnniversary.getTime()) / DAY);
  const elapsed = Math.max(0, (at.getTime() - s.lastAnniversary.getTime()) / DAY);
  const nextEntitlement = vacationDaysFor(s.years + 1);
  const vacationAccrued = round2((nextEntitlement * elapsed) / periodDays);

  // Aguinaldo del año calendario en curso
  const yearStart = new Date(Date.UTC(at.getUTCFullYear(), 0, 1));
  const yearEnd = new Date(Date.UTC(at.getUTCFullYear(), 11, 31));
  const from = e.startDate > yearStart ? e.startDate : yearStart;
  const daysInYear = (Date.UTC(at.getUTCFullYear() + 1, 0, 1) - yearStart.getTime()) / DAY;
  const workedToDate = Math.max(0, Math.floor((at.getTime() - from.getTime()) / DAY) + 1);
  const workedFullYear = Math.max(0, Math.floor((yearEnd.getTime() - from.getTime()) / DAY) + 1);
  // Días de aguinaldo según la antigüedad cumplida al 31 de diciembre
  const aguinaldoDays = aguinaldoDaysFor(seniority(e.startDate, yearEnd).years);
  const aguinaldoToDate = round2((aguinaldoDays * daily * Math.min(workedToDate, daysInYear)) / daysInYear);
  const aguinaldoYear = round2((aguinaldoDays * daily * Math.min(workedFullYear, daysInYear)) / daysInYear);

  return {
    seniority: s,
    vacationEntitled,
    vacationTaken,
    vacationAvailable,
    vacationAccrued,
    nextEntitlement,
    vacationPremiumPerDay: round2(daily * VACATION_PREMIUM),
    vacationPremiumAvailable: round2(vacationAvailable * daily * VACATION_PREMIUM),
    aguinaldoToDate,
    aguinaldoYear,
    aguinaldoDays,
    aguinaldoDaysToDate: round2((aguinaldoDays * Math.min(workedToDate, daysInYear)) / daysInYear),
    weeklySalary: round2(daily * PAID_DAYS_PER_WEEK),
    // 6 días pagados por semana × 52 semanas ÷ 12 meses
    monthlySalary: round2((daily * PAID_DAYS_PER_WEEK * 52) / 12),
  };
}

/** Costo mensual promedio de un empleado: sueldo + aguinaldo y prima vacacional prorrateados (sin carga patronal). */
export function monthlyCost(e: { startDate: Date; dailySalary: number; weeklyBonus?: number }, at = new Date()) {
  const years = seniority(e.startDate, at).years;
  const salary = (e.dailySalary * PAID_DAYS_PER_WEEK * 52) / 12;
  const bonus = ((e.weeklyBonus ?? 0) * 52) / 12;
  const aguinaldo = (aguinaldoDaysFor(years) * e.dailySalary) / 12;
  const premium = (vacationDaysFor(Math.max(1, years + 1)) * e.dailySalary * VACATION_PREMIUM) / 12;
  return round2(salary + bonus + aguinaldo + premium);
}

/** Importes de un renglón de nómina. Las vacaciones se pagan dentro de los días; aparte solo la prima vacacional. */
export function payrollLine(l: {
  dailySalary: number;
  days: number;
  absences: number;
  vacationDays: number;
  overtime: number;
  bonus: number;
  aguinaldo: number;
  otherIncome: number;
  deductions: number;
}) {
  const base = round2(l.dailySalary * Math.max(0, l.days - l.absences));
  const vacationPremium = round2(l.vacationDays * l.dailySalary * VACATION_PREMIUM);
  const gross = round2(base + vacationPremium + l.overtime + l.bonus + l.aguinaldo + l.otherIncome);
  return { base, vacationPremium, gross, net: round2(gross - l.deductions) };
}

export const FREQUENCIES = {
  SEMANAL: { label: "Semanal", perMonth: 52 / 12 },
  QUINCENAL: { label: "Quincenal", perMonth: 2 },
  MENSUAL: { label: "Mensual", perMonth: 1 },
  BIMESTRAL: { label: "Bimestral", perMonth: 1 / 2 },
  TRIMESTRAL: { label: "Trimestral", perMonth: 1 / 3 },
  ANUAL: { label: "Anual", perMonth: 1 / 12 },
} as const;
export type Frequency = keyof typeof FREQUENCIES;
export const toMonthly = (amount: number, frequency: string) => round2(amount * (FREQUENCIES[frequency as Frequency]?.perMonth ?? 1));

export const FIXED_CATEGORIES = ["Renta", "Nómina", "Insumos", "Servicios (luz, agua, internet)", "Software", "Vehículos", "Seguros", "Contabilidad y legales", "Otros"] as const;

/** Punto de equilibrio: órdenes necesarias para cubrir los gastos fijos. */
export function breakEven(p: {
  fixedMonthly: number;
  orderRate: number;
  shippingCost: number;
  shippingMarkup: number; // %
  guideShare: number; // %
  variableCost: number;
  systemFee: number;
  clients: number;
  workingDays: number;
}) {
  const shippingMargin = round2(p.shippingCost * (p.shippingMarkup / 100) * (p.guideShare / 100));
  const marginPerOrder = round2(p.orderRate + shippingMargin - p.variableCost);
  const systemIncome = round2(p.systemFee * p.clients);
  const toCover = Math.max(0, round2(p.fixedMonthly - systemIncome));
  const ordersMonth = marginPerOrder > 0 ? Math.ceil(toCover / marginPerOrder) : Infinity;
  const ordersDay = marginPerOrder > 0 && p.workingDays > 0 ? Math.ceil(toCover / marginPerOrder / p.workingDays) : Infinity;
  // Lo que se le factura al cliente por orden (tarifa + guía con markup), sin IVA
  const billedPerOrder = round2(p.orderRate + p.shippingCost * (1 + p.shippingMarkup / 100) * (p.guideShare / 100));
  return { shippingMargin, marginPerOrder, systemIncome, toCover, ordersMonth, ordersDay, billedPerOrder, revenueMonth: Number.isFinite(ordersMonth) ? round2(ordersMonth * billedPerOrder + systemIncome) : 0 };
}
