import { prisma } from "./db";
import { round2 } from "./money";

/**
 * Asistencia: horario por empleado, checadas del kiosco y salida automática.
 * Todas las horas se manejan en la zona horaria de la empresa (CDMX por defecto).
 */
export const PUNCH_TYPES = ["ENTRADA", "SALIDA_COMIDA", "REGRESO_COMIDA", "SALIDA"] as const;
export type PunchType = (typeof PUNCH_TYPES)[number];
export const PUNCH_LABEL: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA_COMIDA: "Salida a comer",
  REGRESO_COMIDA: "Regreso de comida",
  SALIDA: "Salida",
};

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;

/** Fecha (AAAA-MM-DD), minutos del día y día de la semana (0 = domingo) en la zona horaria indicada. */
export function localParts(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) + Number(p.second) / 60, weekday: days.indexOf(p.weekday) };
}

/** Convierte una hora local (fecha + HH:MM en la zona horaria) a un instante UTC. */
export function zonedTime(dateStr: string, hhmm: string, tz: string) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(toMin(hhmm) / 60), toMin(hhmm) % 60);
  const lp = localParts(new Date(guess), tz);
  const asUtc = Date.UTC(Number(lp.date.slice(0, 4)), Number(lp.date.slice(5, 7)) - 1, Number(lp.date.slice(8, 10))) + lp.minutes * 60000;
  return new Date(guess - (asUtc - guess));
}

export const addDaysStr = (dateStr: string, n: number) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const weekdayOf = (dateStr: string) => new Date(`${dateStr}T12:00:00Z`).getUTCDay();
/** Lunes de la semana de `dateStr`. */
export const mondayOf = (dateStr: string) => addDaysStr(dateStr, -((weekdayOf(dateStr) + 6) % 7));

export type Schedule = { workDays: number; scheduleStart: string; scheduleEnd: string; mealStart: string; mealEnd: string };
/** Día laborable: lunes a viernes (5 días) o lunes a sábado (6 días). */
export const isWorkday = (dateStr: string, s: { workDays: number }) => {
  const wd = weekdayOf(dateStr);
  return wd >= 1 && wd <= (s.workDays === 5 ? 5 : 6);
};

type PunchLike = { type: string; at: Date; source: string };

/** Qué le toca checar al empleado según lo que ya registró hoy y la hora. */
export function nextAction(punches: PunchLike[], s: Schedule, nowMin: number): PunchType | null {
  const last = punches.at(-1)?.type;
  if (!last) return "ENTRADA";
  if (last === "SALIDA") return null;
  if (last === "SALIDA_COMIDA") return "REGRESO_COMIDA";
  if (last === "REGRESO_COMIDA") return "SALIDA";
  // Después de la entrada: si es horario de comida y no ha comido → salida a comer; si no → salida
  const ate = punches.some((p) => p.type === "SALIDA_COMIDA");
  return !ate && nowMin >= toMin(s.mealStart) - 30 && nowMin < toMin(s.mealEnd) ? "SALIDA_COMIDA" : "SALIDA";
}

/** Otras acciones válidas (para corregir si el kiosco eligió la que no era). */
export function validAlternatives(punches: PunchLike[], chosen: PunchType): PunchType[] {
  const last = punches.filter((p) => p.type !== chosen || p !== punches.at(-1)).at(-1)?.type;
  const ate = punches.some((p) => p.type === "SALIDA_COMIDA");
  const options: PunchType[] =
    !last ? ["ENTRADA"] : last === "ENTRADA" ? (ate ? ["SALIDA"] : ["SALIDA_COMIDA", "SALIDA"]) : last === "SALIDA_COMIDA" ? ["REGRESO_COMIDA", "SALIDA"] : last === "REGRESO_COMIDA" ? ["SALIDA"] : [];
  return options.filter((o) => o !== chosen);
}

export type DayStatus = "OK" | "EN_CURSO" | "FALTA" | "DESCANSO" | "PENDIENTE";

/** Resumen de un día: horas trabajadas, comida, retardo, horas extra (solo autorizadas) y estatus. */
export function daySummary(
  punches: PunchLike[],
  s: Schedule,
  opts: { dateStr: string; todayStr: string; nowMin: number; tz: string; toleranceMin: number; otUntil?: string | null; startDate?: Date },
) {
  const local = (d: Date) => localParts(d, opts.tz).minutes;
  const first = (t: string) => punches.find((p) => p.type === t);
  const entrada = first("ENTRADA");
  const comida = first("SALIDA_COMIDA");
  const regreso = first("REGRESO_COMIDA");
  const salida = [...punches].reverse().find((p) => p.type === "SALIDA");
  const workday = isWorkday(opts.dateStr, s);
  const beforeHire = opts.startDate ? opts.dateStr < opts.startDate.toISOString().slice(0, 10) : false;

  let status: DayStatus;
  if (entrada) status = salida ? "OK" : "EN_CURSO";
  else if (!workday || beforeHire) status = "DESCANSO";
  else if (opts.dateStr > opts.todayStr || (opts.dateStr === opts.todayStr && opts.nowMin < toMin(s.scheduleEnd))) status = "PENDIENTE";
  else status = "FALTA";

  const inMin = entrada ? local(entrada.at) : null;
  const endMin = salida ? local(salida.at) : opts.dateStr === opts.todayStr && entrada ? opts.nowMin : null;
  const mealMin = comida && regreso ? Math.max(0, local(regreso.at) - local(comida.at)) : 0;
  // Se paga hasta la hora de salida (o la autorizada en horas extra)
  const paidEnd = endMin === null ? null : Math.min(endMin, toMin(opts.otUntil ?? s.scheduleEnd));
  const workedMin = inMin !== null && paidEnd !== null ? Math.max(0, paidEnd - Math.max(inMin, toMin(s.scheduleStart) - 60) - mealMin) : 0;
  const lateMin = inMin !== null && workday ? Math.max(0, Math.round(inMin - toMin(s.scheduleStart))) : 0;
  const overtimeMin = opts.otUntil && salida && paidEnd !== null ? Math.max(0, Math.round(paidEnd - toMin(s.scheduleEnd))) : 0;
  const earlyMin = salida && endMin !== null ? Math.max(0, Math.round(toMin(s.scheduleEnd) - endMin)) : 0;

  return {
    status,
    workday,
    entrada,
    comida,
    regreso,
    salida,
    autoExit: salida?.source === "AUTO",
    workedHours: round2(workedMin / 60),
    mealMin: Math.round(mealMin),
    lateMin,
    late: lateMin > opts.toleranceMin,
    earlyMin,
    overtimeMin,
  };
}

/**
 * Salida automática: si un empleado no checó su salida y ya pasaron `autoCloseMin` minutos de su hora
 * de salida (o de la hora autorizada de horas extra), se registra la salida a esa hora.
 */
export async function autoCloseShifts(now = new Date()) {
  const s = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true, autoCloseMin: true } });
  const tz = s?.timezone || "America/Mexico_City";
  const grace = s?.autoCloseMin ?? 5;
  const today = localParts(now, tz).date;
  const since = addDaysStr(today, -10);
  const punches = await prisma.punch.findMany({
    where: { deleted: false, workDate: { gte: since, lte: today } },
    orderBy: { at: "asc" },
    include: { employee: { select: { scheduleEnd: true } } },
  });
  const days = new Map<string, typeof punches>();
  for (const p of punches) days.set(`${p.employeeId}|${p.workDate}`, [...(days.get(`${p.employeeId}|${p.workDate}`) ?? []), p]);
  const open = [...days.values()].filter((list) => list.at(-1)!.type !== "SALIDA");
  if (!open.length) return 0;
  const auths = await prisma.overtimeAuth.findMany({ where: { workDate: { gte: since, lte: today } } });
  const authOf = (emp: number, date: string) => auths.find((a) => a.employeeId === emp && a.workDate === date)?.until;

  let closed = 0;
  for (const list of open) {
    const last = list.at(-1)!;
    const until = authOf(last.employeeId, last.workDate) ?? last.employee.scheduleEnd;
    const exitAt = zonedTime(last.workDate, until, tz);
    if (now.getTime() < exitAt.getTime() + grace * 60000) continue;
    // Si salió a comer y no regresó, se cierra igual a la hora de salida
    await prisma.punch.create({
      data: {
        employeeId: last.employeeId,
        type: "SALIDA",
        at: exitAt < last.at ? last.at : exitAt,
        workDate: last.workDate,
        source: "AUTO",
        note: authOf(last.employeeId, last.workDate) ? "Salida automática al terminar las horas extra autorizadas" : "Salida automática (sin horas extra autorizadas)",
      },
    });
    closed++;
  }
  return closed;
}

/** Asistencia de un periodo para la nómina: días trabajados, faltas, retardos (con sus fechas) y minutos de horas extra autorizadas. */
export async function attendanceForPeriod(employeeIds: number[], from: string, to: string) {
  const s = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true, lateToleranceMin: true } });
  const tz = s?.timezone || "America/Mexico_City";
  const now = new Date();
  const { date: today, minutes: nowMin } = localParts(now, tz);
  const [employees, punches, auths] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: employeeIds } } }),
    prisma.punch.findMany({ where: { employeeId: { in: employeeIds }, deleted: false, workDate: { gte: from, lte: to } }, orderBy: { at: "asc" } }),
    prisma.overtimeAuth.findMany({ where: { employeeId: { in: employeeIds }, workDate: { gte: from, lte: to } } }),
  ]);
  const out = new Map<number, { tracked: boolean; present: number; absences: number; lates: number; overtimeMin: number; faltaDates: string[]; lateDates: string[] }>();
  for (const e of employees) {
    const mine = punches.filter((p) => p.employeeId === e.id);
    const r = { tracked: !!e.kioskSecret && mine.length > 0, present: 0, absences: 0, lates: 0, overtimeMin: 0, faltaDates: [] as string[], lateDates: [] as string[] };
    for (let d = from; d <= to; d = addDaysStr(d, 1)) {
      const sum = daySummary(
        mine.filter((p) => p.workDate === d),
        e,
        { dateStr: d, todayStr: today, nowMin, tz, toleranceMin: s?.lateToleranceMin ?? 10, otUntil: auths.find((a) => a.employeeId === e.id && a.workDate === d)?.until, startDate: e.startDate },
      );
      if (sum.entrada) r.present++;
      if (sum.status === "FALTA") {
        r.absences++;
        r.faltaDates.push(d);
      }
      if (sum.late) {
        r.lates++;
        r.lateDates.push(d);
      }
      r.overtimeMin += sum.overtimeMin;
    }
    out.set(e.id, r);
  }
  return out;
}
