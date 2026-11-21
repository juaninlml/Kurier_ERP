import { prisma } from "./db";
import { aguinaldoCutoff, benefits, seniority } from "./payroll";
import { workdaysIn } from "./incidents";

/**
 * Días de vacaciones tomados por empleado desde su último aniversario: los capturados en nóminas, más las
 * vacaciones autorizadas en días que todavía no entran en ninguna nómina (programadas).
 */
export async function vacationTakenMap(employees: { id: number; startDate: Date; workDays: number }[], at = new Date()) {
  if (!employees.length) return new Map<number, number>();
  const ids = employees.map((e) => e.id);
  const [lines, vacations] = await Promise.all([
    prisma.payrollLine.findMany({ where: { employeeId: { in: ids } }, select: { employeeId: true, vacationDays: true, run: { select: { periodStart: true, periodEnd: true } } } }),
    prisma.incident.findMany({ where: { employeeId: { in: ids }, type: "VACACIONES", status: "AUTORIZADA" } }),
  ]);
  const map = new Map<number, number>();
  for (const e of employees) {
    const since = seniority(e.startDate, at).lastAnniversary;
    const mine = lines.filter((l) => l.employeeId === e.id);
    const paid = mine.filter((l) => l.run.periodStart >= since).reduce((a, l) => a + l.vacationDays, 0);
    // Lo que ya cubre una nómina se cuenta ahí; lo posterior a la última nómina, desde la incidencia
    const lastPaid = mine.reduce((m, l) => (l.run.periodEnd.toISOString().slice(0, 10) > m ? l.run.periodEnd.toISOString().slice(0, 10) : m), "");
    const sinceStr = since.toISOString().slice(0, 10);
    const scheduled = vacations
      .filter((v) => v.employeeId === e.id)
      // Las históricas (migración) nunca estuvieron en una nómina: cuentan todas las del periodo
      .reduce((a, v) => a + workdaysIn(v.startDate, v.endDate, e).filter((d) => (v.source === "HISTORICO" || d > lastPaid) && d >= sinceStr).length, 0);
    map.set(e.id, paid + scheduled);
  }
  return map;
}

/** Faltas injustificadas del año (nóminas del 1 de enero al corte del aguinaldo): se restan de los días del aguinaldo. */
export async function unjustifiedMap(employeeIds: number[], year = new Date().getUTCFullYear()) {
  const map = new Map<number, number>();
  if (!employeeIds.length) return map;
  const rows = await prisma.payrollLine.groupBy({
    by: ["employeeId"],
    where: { employeeId: { in: employeeIds }, absences: { gt: 0 }, run: { periodStart: { gte: new Date(Date.UTC(year, 0, 1)), lte: aguinaldoCutoff(year) } } },
    _sum: { absences: true },
  });
  for (const r of rows) map.set(r.employeeId, r._sum.absences ?? 0);
  // Faltas injustificadas capturadas como registro histórico (no están en ninguna nómina)
  const cutoff = aguinaldoCutoff(year).toISOString().slice(0, 10);
  const historic = await prisma.incident.findMany({
    where: { employeeId: { in: employeeIds }, source: "HISTORICO", type: { in: ["FALTA", "DESCANSO_RETARDOS"] }, status: "AUTORIZADA", startDate: { gte: `${year}-01-01`, lte: cutoff } },
    select: { employeeId: true, days: true },
  });
  for (const h of historic) map.set(h.employeeId, (map.get(h.employeeId) ?? 0) + h.days);
  return map;
}

export async function employeeBenefits<T extends { id: number; startDate: Date; dailySalary: number; workDays: number }>(employees: T[]) {
  const [taken, absent] = await Promise.all([vacationTakenMap(employees), unjustifiedMap(employees.map((e) => e.id))]);
  return employees.map((e) => ({ employee: e, b: benefits(e, taken.get(e.id) ?? 0, new Date(), absent.get(e.id) ?? 0) }));
}

/** Catálogo de puestos en orden (área › departamento › puesto). */
export function jobCatalog() {
  return prisma.jobPosition.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, area: true, department: true, name: true },
  });
}
