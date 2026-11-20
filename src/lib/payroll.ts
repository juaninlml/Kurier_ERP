import { round2 } from "./money";
import { requestLang } from "./request-lang";

/**
 * Cálculos de nómina según la Ley Federal del Trabajo (sin ISR, IMSS ni carga patronal).
 * - Vacaciones (art. 76, reforma 2023): 12 días al cumplir el 1er año, +2 por año hasta 20 días al 5º año,
 *   y después +2 cada 5 años (22 del 6º al 10º, 24 del 11º al 15º…).
 * - Prima vacacional (art. 80): 25% del salario de los días de vacaciones.
 * - Aguinaldo (política de Kurier, arriba del mínimo de ley de 15 días): 15 días el primer año, +1 día por
 *   año de antigüedad hasta el 5º año y +2 días por año después, con tope de 30 días. Corte al 20 de diciembre:
 *   es proporcional a lo trabajado del 1 de enero al 20 de diciembre y, si los días proporcionales llegan a
 *   ,6 o más, se sube al día siguiente; si no, se pagan los días con sus decimales. Las faltas injustificadas
 *   (incluido el descanso por 3 retardos) no cuentan como días trabajados.
 * - Semana: se pagan 6 días; el 7º es de descanso y no se paga (por ahora).
 */
export const AGUINALDO_BASE_DAYS = 15;
export const AGUINALDO_MAX_DAYS = 30;
/** Fecha de corte del aguinaldo: 20 de diciembre (mes 11 = diciembre en Date). */
export const AGUINALDO_CUTOFF = { month: 11, day: 20 } as const;
export const aguinaldoCutoff = (year: number) => new Date(Date.UTC(year, AGUINALDO_CUTOFF.month, AGUINALDO_CUTOFF.day));

/** Redondeo de días de aguinaldo: con ,6 o más sube al siguiente día; si no, se pagan los días con decimales (2 dígitos). */
export function roundAguinaldoDays(days: number) {
  const whole = Math.floor(days + 1e-9);
  return days - whole >= 0.6 - 1e-9 ? whole + 1 : round2(days);
}

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
  if (requestLang() === "en") {
    const en = [
      s.years ? `${s.years} year${s.years === 1 ? "" : "s"}` : "",
      s.months ? `${s.months} month${s.months === 1 ? "" : "s"}` : "",
      !s.years && !s.months ? `${s.days} day${s.days === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    return en.join(", ") || "Less than a day";
  }
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
export function benefits(
  e: { startDate: Date; dailySalary: number; weeklySalary?: number; workDays?: number },
  vacationTaken = 0,
  at = new Date(),
  /** Faltas injustificadas del año (incluye los descansos por retardos): se restan de los días del aguinaldo. */
  unjustified = 0,
) {
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

  // Aguinaldo del año en curso: periodo del 1 de enero al corte (20 de diciembre)
  const yearStart = new Date(Date.UTC(at.getUTCFullYear(), 0, 1));
  const cutoff = aguinaldoCutoff(at.getUTCFullYear());
  const from = e.startDate > yearStart ? e.startDate : yearStart;
  const aguinaldoPeriod = Math.round((cutoff.getTime() - yearStart.getTime()) / DAY) + 1; // 354 (355 en bisiesto)
  // Se cuentan días calendario completos (sin importar la hora guardada en la fecha)
  const dayNo = (d: Date) => Math.floor(d.getTime() / DAY);
  const worked = (until: Date) => Math.min(aguinaldoPeriod, Math.max(0, dayNo(until) - dayNo(from) + 1));
  const absent = Math.max(0, unjustified);
  const workedToDate = Math.max(0, worked(at < cutoff ? at : cutoff) - absent);
  const workedAtCutoff = Math.max(0, worked(cutoff) - absent);
  // Días de aguinaldo según la antigüedad cumplida a la fecha de corte
  const aguinaldoDays = aguinaldoDaysFor(seniority(e.startDate, cutoff).years);
  const aguinaldoRawDays = round2((aguinaldoDays * workedAtCutoff) / aguinaldoPeriod);
  const aguinaldoPayDays = roundAguinaldoDays((aguinaldoDays * workedAtCutoff) / aguinaldoPeriod);
  const aguinaldoToDate = round2((aguinaldoDays * daily * workedToDate) / aguinaldoPeriod);
  const aguinaldoYear = round2(aguinaldoPayDays * daily);

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
    aguinaldoRawDays,
    aguinaldoPayDays,
    aguinaldoCutoff: cutoff,
    aguinaldoDaysToDate: round2((aguinaldoDays * workedToDate) / aguinaldoPeriod),
    /** Faltas injustificadas descontadas de los días del aguinaldo. */
    aguinaldoAbsences: absent,
    weeklySalary: round2(weeklyOf(e)),
    // semanal × 52 semanas ÷ 12 meses
    monthlySalary: round2((weeklyOf(e) * 52) / 12),
  };
}

/** Costo mensual promedio de un empleado: sueldo + aguinaldo y prima vacacional prorrateados (sin carga patronal). */
export function monthlyCost(e: { startDate: Date; dailySalary: number; weeklySalary?: number; workDays?: number; weeklyBonus?: number }, at = new Date()) {
  const years = seniority(e.startDate, at).years;
  const salary = (weeklyOf(e) * 52) / 12;
  const bonus = ((e.weeklyBonus ?? 0) * 52) / 12;
  const aguinaldo = (aguinaldoDaysFor(years) * e.dailySalary) / 12;
  const premium = (vacationDaysFor(Math.max(1, years + 1)) * e.dailySalary * VACATION_PREMIUM) / 12;
  return round2(salary + bonus + aguinaldo + premium);
}

/** Salario diario y por hora a partir del semanal: diario = semanal ÷ días laborables (5 o 6); hora = diario ÷ horas de la jornada. */
export function salaryRates(weekly: number, workDays: number, hoursPerDay = 8) {
  const days = workDays === 5 ? 5 : 6;
  const daily = weekly / days;
  return { weekly: round2(weekly), workDays: days, daily, hourly: daily / (hoursPerDay > 0 ? hoursPerDay : 8) };
}

/**
 * Importe de horas extra: horas × salario por hora × tarifa de horas extra (Asistencias → Reglas; 2 = al doble).
 * Salario por hora = semanal ÷ días laborables ÷ horas de la jornada.
 */
export function overtimePay(hours: number, weekly: number, workDays: number, hoursPerDay: number, rate: number) {
  if (!(hours > 0)) return 0;
  return round2(hours * salaryRates(weekly, workDays, hoursPerDay).hourly * (rate > 0 ? rate : 2));
}

/** Horas equivalentes a un importe de horas extra (nóminas capturadas antes, cuando se escribía el importe). */
export function overtimeHoursFrom(amount: number, weekly: number, workDays: number, hoursPerDay: number, rate: number) {
  const perHour = salaryRates(weekly, workDays, hoursPerDay).hourly * (rate > 0 ? rate : 2);
  return amount > 0 && perHour > 0 ? Math.round((amount / perHour) * 100) / 100 : 0;
}

/** Semanal de un empleado (registros anteriores solo tenían salario diario × 6). */
export const weeklyOf = (e: { weeklySalary?: number; dailySalary: number; workDays?: number }) =>
  e.weeklySalary && e.weeklySalary > 0 ? e.weeklySalary : e.dailySalary * (e.workDays ?? PAID_DAYS_PER_WEEK);

/**
 * Importes de un renglón de nómina.
 * - Sueldo = semanal × días pagados ÷ días laborables (= salario diario × días).
 * - Faltas injustificadas: se descuentan a salario diario.
 * - Permisos sin goce: también se descuentan a salario diario, pero no cuentan como faltas injustificadas.
 * - Las vacaciones se pagan dentro de los días; aparte se suma la prima vacacional (25%).
 */
export function payrollLine(l: {
  weeklySalary: number;
  workDays: number;
  hoursPerDay?: number;
  days: number;
  absences: number;
  /** Permisos sin goce de sueldo. */
  leaveDays?: number;
  vacationDays: number;
  overtime: number;
  bonus: number;
  aguinaldo: number;
  otherIncome: number;
  deductions: number;
}) {
  const r = salaryRates(l.weeklySalary, l.workDays, l.hoursPerDay);
  const base = round2((l.weeklySalary * l.days) / r.workDays);
  const absenceDeduction = round2((l.weeklySalary * Math.min(l.absences, l.days)) / r.workDays);
  const leaveDeduction = round2((l.weeklySalary * Math.min(l.leaveDays ?? 0, Math.max(0, l.days - l.absences))) / r.workDays);
  const vacationPremium = round2(l.vacationDays * r.daily * VACATION_PREMIUM);
  const gross = round2(base + vacationPremium + l.overtime + l.bonus + l.aguinaldo + l.otherIncome);
  const totalDeductions = round2(absenceDeduction + leaveDeduction + l.deductions);
  return {
    daily: round2(r.daily),
    hourly: round2(r.hourly),
    workDays: r.workDays,
    base,
    absenceDeduction,
    leaveDeduction,
    vacationPremium,
    gross,
    totalDeductions,
    net: round2(gross - totalDeductions),
  };
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
