"use server";

import { z } from "zod";
import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromInputDate, round2, formatDate } from "@/lib/money";
import { FREQUENCIES, PAID_DAYS_PER_WEEK, payrollLine } from "@/lib/payroll";
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
  const dailySalary = round2(numv(fd, "dailySalary"));
  if (dailySalary <= 0) throw new Error("El salario diario debe ser mayor a 0.");
  const end = str(fd, "endDate");
  return {
    name,
    position: str(fd, "position"),
    area: str(fd, "area"),
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
    dailySalary,
    weeklyBonus: round2(Math.max(0, numv(fd, "weeklyBonus"))),
    notes: str(fd, "notes"),
  };
}

async function createEmployeeImpl(fd: FormData) {
  const e = await prisma.employee.create({ data: employeeData(fd) });
  revalidatePath("/nomina");
  redirect(`/nomina/empleados/${e.id}`);
}
async function updateEmployeeImpl(id: number, fd: FormData) {
  const data = employeeData(fd);
  await prisma.employee.update({ where: { id }, data: { ...data, active: !data.endDate && fd.get("active") === "on" } });
  revalidatePath("/nomina");
  revalidatePath(`/nomina/empleados/${id}`);
  revalidatePath("/contabilidad/gastos-fijos");
  redirect(`/nomina/empleados/${id}`);
}

// ───────────── Nómina semanal ─────────────

/** Crea la nómina del periodo con todos los empleados activos (6 días pagados y su bono fijo). */
async function createPayrollRunImpl(fd: FormData) {
  const periodStart = fromInputDate(str(fd, "periodStart"));
  const periodEnd = fromInputDate(str(fd, "periodEnd"));
  const payDate = fromInputDate(str(fd, "payDate") || str(fd, "periodEnd"));
  if (periodEnd < periodStart) throw new Error("La fecha final del periodo es anterior a la inicial.");
  const employees = await prisma.employee.findMany({ where: { active: true, startDate: { lte: periodEnd } }, orderBy: { name: "asc" } });
  if (!employees.length) throw new Error("No hay empleados activos para este periodo.");
  // Se pagan 6 días por semana; el 7º es descanso sin goce de sueldo (por ahora).
  const calendarDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
  const days = Math.min(PAID_DAYS_PER_WEEK, calendarDays);
  const lines = employees.map((e) => {
    const input = { dailySalary: e.dailySalary, days, absences: 0, vacationDays: 0, overtime: 0, bonus: e.weeklyBonus, aguinaldo: 0, otherIncome: 0, deductions: 0 };
    const t = payrollLine(input);
    return { ...input, employeeId: e.id, vacationPremium: t.vacationPremium, gross: t.gross, net: t.net };
  });
  const run = await prisma.payrollRun.create({
    data: { periodStart, periodEnd, payDate, total: round2(lines.reduce((a, l) => a + l.net, 0)), lines: { create: lines } },
  });
  revalidatePath("/nomina");
  redirect(`/nomina/semanas/${run.id}`);
}

const lineSchema = z.object({
  id: z.number(),
  days: z.number().min(0).max(31),
  absences: z.number().min(0),
  vacationDays: z.number().min(0),
  overtime: z.number().min(0),
  bonus: z.number().min(0),
  aguinaldo: z.number().min(0),
  otherIncome: z.number().min(0),
  deductions: z.number().min(0),
  notes: z.string().default(""),
});

async function savePayrollRunImpl(id: number, fd: FormData) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  if (run.status === "PAGADA") throw new Error("La nómina ya está pagada. Regrésala a borrador para editarla.");
  const parsed = z.array(lineSchema).safeParse(JSON.parse(str(fd, "lines") || "[]"));
  if (!parsed.success) throw new Error(`Revisa los importes: ${parsed.error.issues[0]?.message ?? "datos inválidos"}.`);
  const byId = new Map(run.lines.map((l) => [l.id, l]));
  let total = 0;
  const updates = parsed.data.map((l) => {
    const cur = byId.get(l.id);
    if (!cur) throw new Error("Renglón de nómina inválido.");
    if (l.absences > l.days) throw new Error("Las faltas no pueden ser más que los días pagados.");
    const t = payrollLine({ ...l, dailySalary: cur.dailySalary });
    total += t.net;
    return prisma.payrollLine.update({ where: { id: l.id }, data: { ...l, vacationPremium: t.vacationPremium, gross: t.gross, net: t.net } });
  });
  await prisma.$transaction([
    ...updates,
    prisma.payrollRun.update({
      where: { id },
      data: { total: round2(total), notes: str(fd, "notes"), payDate: fromInputDate(str(fd, "payDate")) },
    }),
  ]);
  revalidatePath(`/nomina/semanas/${id}`);
  revalidatePath("/nomina");
}

/** Marca la nómina como pagada y registra el egreso en contabilidad. */
async function payPayrollRunImpl(id: number) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  if (run.status === "PAGADA") return;
  if (run.total <= 0) throw new Error("La nómina no tiene importe a pagar.");
  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.create({
      data: {
        type: "EGRESO",
        category: "Nómina",
        description: `Nómina del ${formatDate(run.periodStart)} al ${formatDate(run.periodEnd)} (${run.lines.length} empleado(s))`,
        amount: run.total,
        tax: 0,
        date: run.payDate,
        method: "Transferencia",
        reference: `NOM-${run.id}`,
      },
    });
    await tx.payrollRun.update({ where: { id }, data: { status: "PAGADA", transactionId: t.id } });
  });
  revalidatePath(`/nomina/semanas/${id}`);
  revalidatePath("/nomina");
  revalidatePath("/contabilidad");
  revalidatePath("/");
}

async function reopenPayrollRunImpl(id: number) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction([
    ...(run.transactionId ? [prisma.transaction.deleteMany({ where: { id: run.transactionId } })] : []),
    prisma.payrollRun.update({ where: { id }, data: { status: "BORRADOR", transactionId: null } }),
  ]);
  revalidatePath(`/nomina/semanas/${id}`);
  revalidatePath("/nomina");
  revalidatePath("/contabilidad");
}

async function deletePayrollRunImpl(id: number) {
  const run = await prisma.payrollRun.findUniqueOrThrow({ where: { id } });
  if (run.status === "PAGADA") throw new Error("Regresa la nómina a borrador antes de eliminarla.");
  await prisma.payrollRun.delete({ where: { id } });
  revalidatePath("/nomina");
  redirect("/nomina");
}

export const createFixedExpense = safe(createFixedExpenseImpl);
export const updateFixedExpense = safe(updateFixedExpenseImpl);
export const deleteFixedExpense = safe(deleteFixedExpenseImpl);
export const saveBreakEven = safe(saveBreakEvenImpl);
export const createEmployee = safe(createEmployeeImpl);
export const updateEmployee = safe(updateEmployeeImpl);
export const createPayrollRun = safe(createPayrollRunImpl);
export const savePayrollRun = safe(savePayrollRunImpl);
export const payPayrollRun = safe(payPayrollRunImpl);
export const reopenPayrollRun = safe(reopenPayrollRunImpl);
export const deletePayrollRun = safe(deletePayrollRunImpl);
