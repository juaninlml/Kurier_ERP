import { prisma } from "./db";
import { benefits, seniority } from "./payroll";

/** Días de vacaciones tomados por empleado desde su último aniversario (según las nóminas registradas). */
export async function vacationTakenMap(employees: { id: number; startDate: Date }[], at = new Date()) {
  if (!employees.length) return new Map<number, number>();
  const lines = await prisma.payrollLine.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) }, vacationDays: { gt: 0 } },
    select: { employeeId: true, vacationDays: true, run: { select: { periodStart: true } } },
  });
  const map = new Map<number, number>();
  for (const e of employees) {
    const since = seniority(e.startDate, at).lastAnniversary;
    map.set(
      e.id,
      lines.filter((l) => l.employeeId === e.id && l.run.periodStart >= since).reduce((a, l) => a + l.vacationDays, 0),
    );
  }
  return map;
}

export async function employeeBenefits<T extends { id: number; startDate: Date; dailySalary: number }>(employees: T[]) {
  const taken = await vacationTakenMap(employees);
  return employees.map((e) => ({ employee: e, b: benefits(e, taken.get(e.id) ?? 0) }));
}
