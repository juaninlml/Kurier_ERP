import { prisma } from "./db";
import { addDaysStr, attendanceForPeriod, isWorkday } from "./attendance";

/**
 * Incidencias de los empleados: faltas injustificadas, permisos (faltas justificadas con o sin goce),
 * vacaciones y el descanso por retardos (reglamento interior: cada 3 retardos del mes calendario = 1 día
 * de descanso sin goce, que cuenta como falta injustificada y se descuenta del aguinaldo).
 */
export const INCIDENT_TYPES = ["FALTA", "PERMISO", "VACACIONES", "DESCANSO_RETARDOS"] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export const INCIDENT_LABEL: Record<string, string> = {
  FALTA: "Falta injustificada",
  PERMISO: "Permiso / falta justificada",
  VACACIONES: "Vacaciones",
  DESCANSO_RETARDOS: "Descanso por retardos",
};
const PREFIX: Record<string, string> = { FALTA: "FAL", PERMISO: "PER", VACACIONES: "VAC", DESCANSO_RETARDOS: "RET" };
export const incidentFolio = (i: { id: number; type: string }) => `${PREFIX[i.type] ?? "INC"}-${String(i.id).padStart(4, "0")}`;

/** Retardos del mes que generan un día de descanso. */
export const LATES_PER_REST = 3;
/** Faltas injustificadas: se descuentan del sueldo y de los días del aguinaldo. */
export const isUnjustified = (type: string) => type === "FALTA" || type === "DESCANSO_RETARDOS";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** "2026-11" → "noviembre de 2026" */
export const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} de ${key.slice(0, 4)}`;
/** "2026-11-24" → "24/nov" */
export const shortDate = (d: string) => `${d.slice(8, 10)}/${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;
/** "2026-11-24" → "lunes 24 de noviembre de 2026" */
export const longDate = (d: string) => `${WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${Number(d.slice(8, 10))} de ${MONTHS[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`;
/** Rango legible: "24/nov" o "24/nov al 28/nov" */
export const rangeLabel = (from: string, to: string) => (from === to ? shortDate(from) : `${shortDate(from)} al ${shortDate(to)}`);

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Días laborables del empleado entre dos fechas (inclusive), desde su fecha de ingreso. */
export function workdaysIn(from: string, to: string, e: { workDays: number; startDate?: Date }) {
  const hire = e.startDate ? iso(e.startDate) : "";
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) if (d >= hire && isWorkday(d, e)) out.push(d);
  return out;
}

type Inc = { id: number; type: string; startDate: string; endDate: string; withPay: boolean; status: string; source: string; monthKey: string };
const PRIORITY: Record<string, number> = { VACACIONES: 0, PERMISO: 1, DESCANSO_RETARDOS: 2, FALTA: 3 };
/** La incidencia autorizada que cubre un día (vacaciones y permisos ganan a las faltas). */
const covering = (list: Inc[], d: string) =>
  list.filter((i) => i.status === "AUTORIZADA" && i.startDate <= d && i.endDate >= d).sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type])[0];

type Emp = { id: number; workDays: number; startDate: Date };

/**
 * Regla de retardos: por cada 3 retardos de un mes calendario se programa un día de descanso (falta injustificada)
 * en el primer día laborable libre después del periodo de la nómina. No se duplica: cuenta los descansos que ya
 * existen de ese mes (también los cancelados, que equivalen a perdonarlos).
 */
async function ensureLateRests(employees: Emp[], periodStart: string, periodEnd: string, att: Awaited<ReturnType<typeof attendanceForPeriod>>, by: string) {
  const ids = employees.map((e) => e.id);
  const [existing, future] = await Promise.all([
    prisma.incident.findMany({ where: { employeeId: { in: ids }, type: "DESCANSO_RETARDOS", monthKey: { gte: addDaysStr(periodStart, -7).slice(0, 7) } } }),
    prisma.incident.findMany({ where: { employeeId: { in: ids }, status: { not: "RECHAZADA" }, endDate: { gt: periodEnd } } }),
  ]);
  for (const e of employees) {
    const a = att.get(e.id);
    if (!a?.tracked || a.lateDates.length < LATES_PER_REST) continue;
    const byMonth = new Map<string, string[]>();
    for (const d of a.lateDates) byMonth.set(d.slice(0, 7), [...(byMonth.get(d.slice(0, 7)) ?? []), d]);
    let cursor = periodEnd;
    const taken = (d: string) => future.some((i) => i.employeeId === e.id && i.startDate <= d && i.endDate >= d);
    for (const [month, dates] of byMonth) {
      const earned = Math.floor(dates.length / LATES_PER_REST);
      const have = existing.filter((i) => i.employeeId === e.id && i.monthKey === month).length;
      for (let k = have; k < earned; k++) {
        // Siguiente día laborable libre (la semana que sigue a la nómina)
        let d = addDaysStr(cursor, 1);
        while (!isWorkday(d, e) || taken(d)) d = addDaysStr(d, 1);
        cursor = d;
        const lates = dates.slice(k * LATES_PER_REST, (k + 1) * LATES_PER_REST);
        const created = await prisma.incident.create({
          data: {
            employeeId: e.id,
            type: "DESCANSO_RETARDOS",
            startDate: d,
            endDate: d,
            days: 1,
            status: "AUTORIZADA",
            source: "AUTO",
            monthKey: month,
            lateDates: lates.join(","),
            reason: `${LATES_PER_REST} retardos en ${monthName(month)}: ${lates.map(shortDate).join(", ")}`,
            decidedAt: new Date(),
            decidedBy: "Regla de retardos",
            createdBy: by,
          },
        });
        future.push(created);
      }
    }
  }
}

export type PayrollIncidents = {
  absences: number;
  vacationDays: number;
  leaveDays: number;
  absenceNote: string;
  notice: string;
};

/**
 * Prepara las incidencias de una nómina:
 * 1. Programa los descansos por retardos que se hayan acumulado (aparecen como aviso en esta nómina).
 * 2. Registra como falta injustificada los días sin checada (kiosco) y quita las que ya se corrigieron.
 * 3. Resume la semana: faltas injustificadas, vacaciones, permisos sin goce, detalle y aviso del recibo.
 */
export async function syncPayrollIncidents(employees: Emp[], from: string, to: string, by = "") {
  const ids = employees.map((e) => e.id);
  const monthFrom = `${addDaysStr(from, -7).slice(0, 7)}-01`;
  const att = await attendanceForPeriod(ids, monthFrom < from ? monthFrom : from, to);
  await ensureLateRests(employees, from, to, att, by);

  const list = await prisma.incident.findMany({
    where: { employeeId: { in: ids }, startDate: { lte: addDaysStr(to, 10) }, endDate: { gte: from } },
    orderBy: { startDate: "asc" },
  });
  // Faltas del kiosco que ya no aplican (se corrigió la checada): se quitan
  const stale = list.filter((i) => i.source === "KIOSCO" && i.startDate >= from && i.startDate <= to && !att.get(i.employeeId)?.faltaDates.includes(i.startDate));
  if (stale.length) await prisma.incident.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });
  const live = list.filter((i) => !stale.includes(i));

  // Días sin checada que no tienen incidencia → falta injustificada (queda en el historial del empleado)
  for (const e of employees) {
    const a = att.get(e.id);
    if (!a?.tracked) continue;
    for (const d of a.faltaDates.filter((d) => d >= from && d <= to)) {
      const mine = live.filter((i) => i.employeeId === e.id);
      // Una falta ya registrada, o un permiso/vacaciones autorizados, ya cubren el día
      if (mine.some((i) => (i.type === "FALTA" ? i.status !== "RECHAZADA" : i.status === "AUTORIZADA") && i.startDate <= d && i.endDate >= d)) continue;
      live.push(
        await prisma.incident.create({
          data: { employeeId: e.id, type: "FALTA", startDate: d, endDate: d, days: 1, status: "AUTORIZADA", source: "KIOSCO", reason: "Sin checada de entrada en el kiosco", decidedAt: new Date(), decidedBy: "Kiosco", createdBy: by },
        }),
      );
    }
  }

  const out = new Map<number, PayrollIncidents & { lates: string[] }>();
  for (const e of employees) {
    const mine = live.filter((i) => i.employeeId === e.id);
    const unjust: string[] = [];
    const vac: string[] = [];
    const unpaid: string[] = [];
    const paid: string[] = [];
    // Los registros históricos (migración) ya se pagaron fuera del ERP: no entran a la nómina
    const payable = mine.filter((i) => i.source !== "HISTORICO");
    for (const d of workdaysIn(from, to, e)) {
      const i = covering(payable, d);
      if (!i) continue;
      if (i.type === "VACACIONES") vac.push(d);
      else if (i.type === "PERMISO") (i.withPay ? paid : unpaid).push(d);
      else unjust.push(i.type === "DESCANSO_RETARDOS" ? `${shortDate(d)} (descanso por retardos)` : i.source === "KIOSCO" ? `${shortDate(d)} (sin checada)` : shortDate(d));
    }
    const note = [
      unjust.length && `Faltas injustificadas: ${unjust.join(", ")}`,
      unpaid.length && `Permiso sin goce: ${unpaid.map(shortDate).join(", ")}`,
      paid.length && `Permiso con goce: ${paid.map(shortDate).join(", ")}`,
      vac.length && `Vacaciones: ${vac.map(shortDate).join(", ")}`,
    ].filter(Boolean);
    // Aviso: descansos por retardos programados para después de esta nómina
    const rests = mine.filter((i) => i.type === "DESCANSO_RETARDOS" && i.status === "AUTORIZADA" && i.startDate > to);
    const notice = rests
      .map((r) => `Acumulaste ${LATES_PER_REST} retardos en ${monthName(r.monthKey)} (${r.lateDates.split(",").filter(Boolean).map(shortDate).join(", ")}): descansas el ${longDate(r.startDate)}. Se registra como falta injustificada sin goce de sueldo.`)
      .join(" ");
    out.set(e.id, { absences: unjust.length, vacationDays: vac.length, leaveDays: unpaid.length, absenceNote: note.join(" · "), notice, lates: att.get(e.id)?.lateDates ?? [] });
  }
  return out;
}

/** Retardos de un mes (AAAA-MM) de un empleado, hasta hoy. */
export async function monthLates(employeeId: number, month: string, today: string) {
  const last = addDaysStr(`${addDaysStr(`${month}-28`, 4).slice(0, 7)}-01`, -1);
  const att = await attendanceForPeriod([employeeId], `${month}-01`, today < last ? today : last);
  return att.get(employeeId)?.lateDates ?? [];
}
