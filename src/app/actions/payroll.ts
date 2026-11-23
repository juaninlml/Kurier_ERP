"use server";

import { z } from "zod";
import { safe } from "@/lib/safe-action";
import { queueArchive } from "@/lib/archive";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromInputDate, round2, formatDateEs } from "@/lib/money";
import { FREQUENCIES, payrollLine, weeklyOf, overtimePay, payMethodOf } from "@/lib/payroll";
import { attendanceForPeriod } from "@/lib/attendance";
import { syncPayrollIncidents } from "@/lib/incidents";
import { getCurrentUser, requireAdmin } from "@/lib/current-user";
import { numv, str } from "./helpers";

// ───────────── Gastos fijos ─────────────

function expenseData(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Escribe el concepto del gasto.");
  const amount = round2(numv(fd, "amount"));
  if (amount <= 0) throw new Error("El monto debe ser mayor a 0.");
  const frequency = str(fd, "frequency") || "MENSUAL";
  if (!(frequency in FREQUENCIES)) throw new Error("Frecuencia inválida.");
  return { name, category: str(fd, "category") || "Otros", amount, frequency, notes: str(fd, "notes") };
}
const refreshFixed = () => revalidatePath("/contabilidad/gastos-fijos");

async function createFixedExpenseImpl(fd: FormData) {
  const last = await prisma.fixedExpense.aggregate({ _max: { sortOrder: true } });
  await prisma.fixedExpense.create({ data: { ...expenseData(fd), sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  refreshFixed();
}
async function updateFixedExpenseImpl(id: number, fd: FormData) {
  await prisma.fixedExpense.update({ where: { id }, data: { ...expenseData(fd), active: fd.get("active") === "on" } });
  refreshFixed();
}
async function deleteFixedExpenseImpl(id: number) {
  await prisma.fixedExpense.delete({ where: { id } });
  refreshFixed();
}

/** Supuestos del punto de equilibrio. */
async function saveBreakEvenImpl(fd: FormData) {
  const pos = (k: string, def = 0) => Math.max(0, numv(fd, k, def));
  await prisma.companySettings.update({
    where: { id: 1 },
    data: {
      beOrderRate: pos("beOrderRate"),
      beShippingCost: pos("beShippingCost"),
      beShippingMarkup: pos("beShippingMarkup"),
      beGuideShare: Math.min(100, pos("beGuideShare")),
      beVariableCost: pos("beVariableCost"),
      beSystemFee: pos("beSystemFee"),
      beClients: Math.round(pos("beClients")),
      beWorkingDays: Math.max(1, pos("beWorkingDays", 26)),
      beIncludePayroll: fd.get("beIncludePayroll") === "on",
    },
  });
  refreshFixed();
}

// ───────────── Empleados ─────────────

function employeeData(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre del empleado es obligatorio.");
  const start = str(fd, "startDate");
  if (!start) throw new Error("Indica la fecha de ingreso.");
  const weeklySalary = round2(numv(fd, "weeklySalary"));
  if (weeklySalary <= 0) throw new Error("El salario semanal debe ser mayor a 0.");
  const workDays = numv(fd, "workDays", 6) === 5 ? 5 : 6;
  const hoursPerDay = Math.min(24, Math.max(1, numv(fd, "hoursPerDay", 8)));
  // El diario se guarda calculado (semanal ÷ días laborables) para vacaciones, prima y aguinaldo
  const dailySalary = weeklySalary / workDays;
  const end = str(fd, "endDate");
  return {
    name,
    rfc: str(fd, "rfc").toUpperCase(),
    curp: str(fd, "curp").toUpperCase(),
    nss: str(fd, "nss"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    address: str(fd, "address"),
    bankName: str(fd, "bankName"),
    clabe: str(fd, "clabe"),
    startDate: fromInputDate(start),
    endDate: end ? fromInputDate(end) : null,
    weeklySalary,
    workDays,
    hoursPerDay,
    dailySalary,
    weeklyBonus: round2(Math.max(0, numv(fd, "weeklyBonus"))),
    notes: str(fd, "notes"),
    ...scheduleData(fd),
  };
}

/** Horario del empleado (HH:MM). La comida debe quedar dentro de la jornada. */
function scheduleData(fd: FormData) {
  const t = (k: string, def: string) => {
    const v = str(fd, k) || def;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error("Revisa el horario (formato HH:MM).");
    return v;
  };
  const s = { scheduleStart: t("scheduleStart", "09:00"), scheduleEnd: t("scheduleEnd", "18:00"), mealStart: t("mealStart", "14:00"), mealEnd: t("mealEnd", "15:00") };
  if (!(s.scheduleStart < s.mealStart && s.mealStart < s.mealEnd && s.mealEnd <= s.scheduleEnd)) {
    throw new Error("El horario no cuadra: la comida debe quedar entre la entrada y la salida.");
  }
  return s;
}

/**
 * Puesto del catálogo: copia nombre, área y departamento al empleado.
 * "actual" conserva el puesto escrito a mano antes del catálogo; vacío = sin puesto.
 */
async function jobData(fd: FormData) {
  const v = str(fd, "jobPositionId");
  if (v === "actual") return {};
  const id = Number(v);
  if (!id) return { jobPositionId: null, position: "", area: "", department: "" };
  const p = await prisma.jobPosition.findUnique({ where: { id } });
  if (!p) throw new Error("Ese puesto ya no existe; elige otro.");
  return { jobPositionId: p.id, position: p.name, area: p.area, department: p.department };
}

async function createEmployeeImpl(fd: FormData) {
  const e = await prisma.employee.create({ data: { ...employeeData(fd), ...(await jobData(fd)) } });
  revalidatePath("/nomina");
  redirect(`/nomina/empleados/${e.id}`);
}
async function updateEmployeeImpl(id: number, fd: FormData) {
  const data = { ...employeeData(fd), ...(await jobData(fd)) };
  await prisma.employee.update({ where: { id }, data: { ...data, active: !data.endDate && fd.get("active") === "on" } });
  revalidatePath("/nomina");
  revalidatePath(`/nomina/empleados/${id}`);
  revalidatePath("/contabilidad/gastos-fijos");
  // Sin redirect: el formulario está en esta misma página (redirigir a la misma URL aborta la respuesta)
}

// ───────────── Puestos (área › departamento › puesto) ─────────────

function jobPositionData(fd: FormData) {
  const area = str(fd, "area");
  const name = str(fd, "name");
  if (!area) throw new Error("Indica el área del puesto (ej. Almacén).");
  if (!name) throw new Error("Escribe el nombre del puesto.");
  return { area, department: str(fd, "department"), name };
}
const refreshJobs = () => {
  revalidatePath("/nomina");
  revalidatePath("/nomina/puestos");
};

async function createJobPositionImpl(fd: FormData) {
  const data = jobPositionData(fd);
  const dup = await prisma.jobPosition.findFirst({ where: { area: data.area, department: data.department, name: data.name } });
  if (dup) throw new Error("Ese puesto ya existe en ese departamento.");
  const last = await prisma.jobPosition.aggregate({ _max: { sortOrder: true } });
  await prisma.jobPosition.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 10 } });
  refreshJobs();
}
async function updateJobPositionImpl(id: number, fd: FormData) {
  const data = jobPositionData(fd);
  await prisma.$transaction([
    prisma.jobPosition.update({ where: { id }, data }),
    // Los empleados con ese puesto se actualizan al nuevo nombre, área y departamento
    prisma.employee.updateMany({ where: { jobPositionId: id }, data: { position: data.name, area: data.area, department: data.department } }),
  ]);
  refreshJobs();
}
async function deleteJobPositionImpl(id: number) {
  const used = await prisma.employee.count({ where: { jobPositionId: id, active: true } });
  if (used) throw new Error("No se puede eliminar: hay empleados activos con este puesto. Cámbialos primero.");
  // Los dados de baja conservan el texto del puesto
  await prisma.jobPosition.delete({ where: { id } });
  refreshJobs();
}

// ───────────── Nómina semanal ─────────────

/** Marca que paga la nómina: 0 o vacío = la principal; si no existe o está inactiva, error. */
async function payrollBrand(fd: FormData): Promise<number | null> {
  const id = Math.round(numv(fd, "brandId", 0));
  if (!id) return null;
  const b = await prisma.brand.findUnique({ where: { id }, select: { active: true } });
  if (!b?.active) throw new Error("Elige una marca activa para la nómina.");
  return id;
}

/** Crea la nómina del periodo con todos los empleados activos (sus días laborables y su bono fijo). */
async function createPayrollRunImpl(fd: FormData) {
  const periodStart = fromInputDate(str(fd, "periodStart"));
  const periodEnd = fromInputDate(str(fd, "periodEnd"));
  const payDate = fromInputDate(str(fd, "payDate") || str(fd, "periodEnd"));
  const brandId = await payrollBrand(fd);
  if (periodEnd < periodStart) throw new Error("La fecha final del periodo es anterior a la inicial.");
  const employees = await prisma.employee.findMany({ where: { active: true, startDate: { lte: periodEnd } }, orderBy: { name: "asc" } });
  if (!employees.length) throw new Error("No hay empleados activos para este periodo.");
  // Se pagan los días laborables de cada empleado (5 o 6); el descanso no se paga (por ahora).
  const calendarDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
  // Asistencia del kiosco: faltas y horas extra autorizadas del periodo (solo empleados que ya checan)
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const me = await getCurrentUser();
  // Incidencias: faltas (kiosco y registradas), permisos, vacaciones autorizadas y descansos por retardos
  const incidents = await syncPayrollIncidents(employees, iso(periodStart), iso(periodEnd), me.name || me.email);
  const [attendance, cfg] = await Promise.all([
    attendanceForPeriod(employees.map((e) => e.id), iso(periodStart), iso(periodEnd)),
    prisma.companySettings.findUnique({ where: { id: 1 }, select: { overtimeRate: true } }),
  ]);
  const lines = employees.map((e) => {
    const weeklySalary = weeklyOf(e);
    const workDays = e.workDays === 5 ? 5 : 6;
    const days = Math.min(workDays, calendarDays);
    const att = attendance.get(e.id);
    const tracked = !!att?.tracked;
    const overtimeHours = tracked ? Math.round((att!.overtimeMin / 60) * 100) / 100 : 0;
    const overtime = overtimePay(overtimeHours, weeklySalary, workDays, e.hoursPerDay, cfg?.overtimeRate ?? 2);
    const inc = incidents.get(e.id);
    const absences = Math.min(days, inc?.absences ?? 0);
    const input = {
      weeklySalary,
      workDays,
      hoursPerDay: e.hoursPerDay,
      days,
      absences,
      leaveDays: Math.min(days - absences, inc?.leaveDays ?? 0),
      vacationDays: Math.min(days, inc?.vacationDays ?? 0),
      absenceNote: inc?.absenceNote ?? "",
      notice: inc?.notice ?? "",
      overtimeHours,
      overtime,
      notes: tracked
        ? `Asistencia: ${att!.present} día(s), ${att!.absences} falta(s), ${att!.lates} retardo(s)${att!.overtimeMin ? `, ${(att!.overtimeMin / 60).toFixed(2)} h extra` : ""}`
        : "",
      bonus: e.weeklyBonus,
      aguinaldo: 0,
      otherIncome: 0,
      deductions: 0,
    };
    const t = payrollLine(input);
    return { ...input, dailySalary: weeklySalary / workDays, employeeId: e.id, vacationPremium: t.vacationPremium, gross: t.gross, net: t.net };
  });
  const run = await prisma.payrollRun.create({
    data: { periodStart, periodEnd, payDate, brandId, total: round2(lines.reduce((a, l) => a + l.net, 0)), lines: { create: lines } },
  });
  revalidatePath("/nomina");
  redirect(`/nomina/semanas/${run.id}`);
}

const lineSchema = z.object({
  id: z.number(),
  workDays: z.union([z.literal(5), z.literal(6)]),
  days: z.number().min(0).max(31),
  absences: z.number().min(0),
  leaveDays: z.number().min(0).default(0),
  vacationDays: z.number().min(0),
  overtimeHours: z.number().min(0).max(168),
  bonus: z.number().min(0),
  bonusNote: z.string().default(""),
  aguinaldo: z.number().min(0),
  otherIncome: z.number().min(0),
  deductions: z.number().min(0),
  deductionNote: z.string().default(""),
  notes: z.string().default(""),
});

async function savePayrollRunImpl(id: number, fd: FormData) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  if (run.status !== "BORRADOR") throw new Error("La nómina ya está aprobada. Regrésala a borrador para editarla.");
  const [brandId, cfg] = await Promise.all([payrollBrand(fd), prisma.companySettings.findUnique({ where: { id: 1 }, select: { overtimeRate: true } })]);
  const parsed = z.array(lineSchema).safeParse(JSON.parse(str(fd, "lines") || "[]"));
  if (!parsed.success) throw new Error(`Revisa los importes: ${parsed.error.issues[0]?.message ?? "datos inválidos"}.`);
  const byId = new Map(run.lines.map((l) => [l.id, l]));
  let total = 0;
  const updates = parsed.data.map((l) => {
    const cur = byId.get(l.id);
    if (!cur) throw new Error("Renglón de nómina inválido.");
    if (l.absences + l.leaveDays > l.days) throw new Error("Las faltas y permisos sin goce no pueden ser más que los días a pagar.");
    if (l.days > l.workDays) throw new Error(`Los días a pagar no pueden ser más que la jornada de ${l.workDays} días.`);
    if (l.bonus > 0 && !l.bonusNote.trim()) throw new Error("Escribe el motivo de cada bono.");
    const weeklySalary = cur.weeklySalary || cur.dailySalary * cur.workDays;
    const overtime = overtimePay(l.overtimeHours, weeklySalary, l.workDays, cur.hoursPerDay, cfg?.overtimeRate ?? 2);
    const t = payrollLine({ ...l, overtime, weeklySalary, hoursPerDay: cur.hoursPerDay });
    total += t.net;
    return prisma.payrollLine.update({
      where: { id: l.id },
      data: { ...l, overtime, weeklySalary, dailySalary: weeklySalary / l.workDays, vacationPremium: t.vacationPremium, gross: t.gross, net: t.net },
    });
  });
  await prisma.$transaction([
    ...updates,
    prisma.payrollRun.update({
      where: { id },
      data: { total: round2(total), notes: str(fd, "notes"), payDate: fromInputDate(str(fd, "payDate")), brandId },
    }),
  ]);
  revalidatePath(`/nomina/semanas/${id}`);
  revalidatePath("/nomina");
}

/**
 * Vuelve a leer las incidencias de la semana (faltas, permisos, vacaciones y descansos por retardos) en una nómina
 * en borrador. Solo cambia faltas, permisos sin goce, vacaciones y sus notas; lo demás se respeta.
 */
async function refreshPayrollIncidentsImpl(id: number) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id }, include: { lines: { include: { employee: true } } } });
  if (run.status !== "BORRADOR") throw new Error("La nómina ya está aprobada. Regrésala a borrador para actualizarla.");
  const me = await getCurrentUser();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const incidents = await syncPayrollIncidents(run.lines.map((l) => l.employee), iso(run.periodStart), iso(run.periodEnd), me.name || me.email);
  let total = 0;
  const updates = run.lines.map((l) => {
    const inc = incidents.get(l.employeeId);
    const absences = Math.min(l.days, inc?.absences ?? 0);
    const data = {
      absences,
      leaveDays: Math.min(l.days - absences, inc?.leaveDays ?? 0),
      vacationDays: Math.min(l.days, inc?.vacationDays ?? 0),
      absenceNote: inc?.absenceNote ?? "",
      notice: inc?.notice ?? "",
    };
    const t = payrollLine({ ...l, ...data, weeklySalary: l.weeklySalary || l.dailySalary * l.workDays });
    total += t.net;
    return prisma.payrollLine.update({ where: { id: l.id }, data: { ...data, vacationPremium: t.vacationPremium, gross: t.gross, net: t.net } });
  });
  await prisma.$transaction([...updates, prisma.payrollRun.update({ where: { id }, data: { total: round2(total) } })]);
  revalidatePath(`/nomina/semanas/${id}`);
  revalidatePath("/nomina");
}

const refreshRun = (id: number) => {
  revalidatePath(`/nomina/semanas/${id}`);
  revalidatePath("/nomina");
  revalidatePath("/contabilidad");
  revalidatePath("/");
};

/** Aprueba la nómina: ya no se edita y pasa a pagos (solo el neto de cada empleado). Solo administradores. */
async function approvePayrollRunImpl(id: number) {
  const me = await requireAdmin();
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id } });
  if (run.status !== "BORRADOR") throw new Error("Solo se puede aprobar una nómina en borrador.");
  if (run.total <= 0) throw new Error("La nómina no tiene importe a pagar.");
  await prisma.payrollRun.update({ where: { id }, data: { status: "APROBADA", approvedAt: new Date(), approvedBy: me.name || me.email } });
  refreshRun(id);
}

/** Registra el egreso en contabilidad y marca la nómina como pagada (cuando ya se pagó a todos). */
async function finishPayroll(id: number) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id }, include: { lines: { include: { employee: { select: { clabe: true } } } }, brand: { select: { tradeName: true } } } });
  if (run.status === "PAGADA") return;
  const payer = run.brand?.tradeName ?? (await prisma.companySettings.findUnique({ where: { id: 1 }, select: { tradeName: true } }))?.tradeName ?? "";
  const methods = new Set(run.lines.filter((l) => l.net > 0).map((l) => payMethodOf(l, l.employee)));
  const lastPaid = run.lines.reduce<Date | null>((m, l) => (l.paidAt && (!m || l.paidAt > m) ? l.paidAt : m), null);
  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        type: "EGRESO",
        category: "Nómina",
        description: `Nómina del ${formatDateEs(run.periodStart)} al ${formatDateEs(run.periodEnd)} (${run.lines.length} empleado(s))${payer ? ` · paga ${payer}` : ""}`,
        amount: run.total,
        tax: 0,
        date: lastPaid ?? run.payDate,
        method: methods.size > 1 ? "Transferencia y efectivo" : methods.has("EFECTIVO") ? "Efectivo" : "Transferencia",
        reference: `NOM-${run.id}`,
      },
    });
    await tx.payrollRun.update({ where: { id }, data: { status: "PAGADA", transactionId: t.id } });
  });
  queueArchive(`nomina:${id}`);
}

/** Marca (o desmarca) el pago de un empleado. Al quedar todos pagados, la nómina pasa a PAGADA. */
async function setPayrollLinePaidImpl(lineId: number, paid: boolean) {
  const me = await getCurrentUser();
  const line = await prisma.payrollLine.findUniqueOrThrow({ where: { id: lineId }, include: { run: true } });
  const run = line.run;
  if (run.status === "BORRADOR") throw new Error("Primero hay que aprobar la nómina.");
  await prisma.payrollLine.update({ where: { id: lineId }, data: paid ? { paidAt: new Date(), paidBy: me.name || me.email } : { paidAt: null, paidBy: "" } });
  if (paid) {
    // Los empleados con neto 0 no tienen nada que pagar
    const pending = await prisma.payrollLine.count({ where: { runId: run.id, paidAt: null, net: { gt: 0 } } });
    if (pending === 0) await finishPayroll(run.id);
  } else if (run.status === "PAGADA") {
    // Se desmarcó a alguien: vuelve a aprobada y se quita el egreso
    await prisma.$transaction([
      ...(run.transactionId ? [prisma.transaction.deleteMany({ where: { id: run.transactionId } })] : []),
      prisma.payrollRun.update({ where: { id: run.id }, data: { status: "APROBADA", transactionId: null } }),
    ]);
  }
  refreshRun(run.id);
}

/** Cambia el método de pago (transferencia o efectivo) de un empleado en una nómina aprobada. */
async function setPayrollLineMethodImpl(lineId: number, method: string) {
  if (method !== "TRANSFERENCIA" && method !== "EFECTIVO") throw new Error("Método de pago inválido.");
  const line = await prisma.payrollLine.findUniqueOrThrow({ where: { id: lineId }, include: { run: true } });
  if (line.paidAt) throw new Error("Ese pago ya está marcado; desmárcalo para cambiar el método.");
  await prisma.payrollLine.update({ where: { id: lineId }, data: { payMethod: method } });
  refreshRun(line.runId);
}

/** Regresa la nómina a borrador para editarla: quita las marcas de pago y, si estaba pagada, el egreso. */
async function reopenPayrollRunImpl(id: number) {
  await requireAdmin();
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    ...(run.transactionId ? [prisma.transaction.deleteMany({ where: { id: run.transactionId } })] : []),
    prisma.payrollLine.updateMany({ where: { runId: id }, data: { paidAt: null, paidBy: "" } }),
    prisma.payrollRun.update({ where: { id }, data: { status: "BORRADOR", transactionId: null, approvedAt: null, approvedBy: "" } }),
  ]);
  refreshRun(id);
}

async function deletePayrollRunImpl(id: number) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id } });
  if (run.status !== "BORRADOR") throw new Error("Regresa la nómina a borrador antes de eliminarla.");
  await prisma.payrollRun.delete({ where: { id } });
  revalidatePath("/nomina");
  redirect("/nomina");
}

export const createFixedExpense = safe(createFixedExpenseImpl, "nomina", "createFixedExpenseImpl");
export const updateFixedExpense = safe(updateFixedExpenseImpl, "nomina", "updateFixedExpenseImpl");
export const deleteFixedExpense = safe(deleteFixedExpenseImpl, "nomina", "deleteFixedExpenseImpl");
export const saveBreakEven = safe(saveBreakEvenImpl, "nomina", "saveBreakEvenImpl");
export const createEmployee = safe(createEmployeeImpl, "nomina", "createEmployeeImpl");
export const updateEmployee = safe(updateEmployeeImpl, "nomina", "updateEmployeeImpl");
export const createJobPosition = safe(createJobPositionImpl, "nomina", "createJobPositionImpl");
export const updateJobPosition = safe(updateJobPositionImpl, "nomina", "updateJobPositionImpl");
export const deleteJobPosition = safe(deleteJobPositionImpl, "nomina", "deleteJobPositionImpl");
export const createPayrollRun = safe(createPayrollRunImpl, "nomina", "createPayrollRunImpl");
export const savePayrollRun = safe(savePayrollRunImpl, "nomina", "savePayrollRunImpl");
export const approvePayrollRun = safe(approvePayrollRunImpl, "nomina", "approvePayrollRunImpl");
export const setPayrollLinePaid = safe(setPayrollLinePaidImpl, "nomina", "setPayrollLinePaidImpl");
export const setPayrollLineMethod = safe(setPayrollLineMethodImpl, "nomina", "setPayrollLineMethodImpl");
export const refreshPayrollIncidents = safe(refreshPayrollIncidentsImpl, "nomina", "refreshPayrollIncidentsImpl");
export const reopenPayrollRun = safe(reopenPayrollRunImpl, "nomina", "reopenPayrollRunImpl");
export const deletePayrollRun = safe(deletePayrollRunImpl, "nomina", "deletePayrollRunImpl");
