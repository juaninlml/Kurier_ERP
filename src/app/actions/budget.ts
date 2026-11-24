"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auditNote } from "@/lib/audit";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { formatMoney, round2 } from "@/lib/money";
import { UserError } from "@/lib/user-error";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function checkPeriod(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("Periodo inválido.");
}

/** Guarda el presupuesto del mes. Campos: b:INGRESO|Categoría = monto (vacío o 0 = sin presupuesto). */
async function saveBudgetImpl(year: number, month: number, fd: FormData) {
  checkPeriod(year, month);
  const valid = new Set([...INCOME_CATEGORIES.map((c) => `INGRESO|${c}`), ...EXPENSE_CATEGORIES.map((c) => `EGRESO|${c}`)]);
  const ops = [];
  let total = 0;
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("b:")) continue;
    const key = k.slice(2);
    if (!valid.has(key)) continue;
    const [type, category] = key.split("|");
    const raw = String(v).replace(/,/g, "").trim();
    const amount = raw === "" ? 0 : round2(Number(raw));
    if (!Number.isFinite(amount) || amount < 0) throw new UserError("Monto inválido en {v0}.", { v0: category });
    const where = { year_month_type_category: { year, month, type, category } };
    if (amount === 0) ops.push(prisma.budget.deleteMany({ where: { year, month, type, category } }));
    else ops.push(prisma.budget.upsert({ where, create: { year, month, type, category, amount }, update: { amount } }));
    if (type === "EGRESO") total += amount;
  }
  await prisma.$transaction(ops);
  auditNote(`Presupuesto de ${MONTHS[month - 1]} ${year}: egresos ${formatMoney(total)}`, `/contabilidad/presupuesto?anio=${year}&mes=${month}`);
  revalidatePath("/contabilidad/presupuesto");
}

/** Copia el presupuesto del mes anterior (solo las categorías que aún no tienen monto este mes). */
async function copyPreviousImpl(year: number, month: number) {
  checkPeriod(year, month);
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const [from, current] = await Promise.all([prisma.budget.findMany({ where: prev }), prisma.budget.findMany({ where: { year, month } })]);
  if (!from.length) throw new Error("El mes anterior no tiene presupuesto para copiar.");
  const have = new Set(current.map((b) => `${b.type}|${b.category}`));
  const data = from.filter((b) => !have.has(`${b.type}|${b.category}`)).map((b) => ({ year, month, type: b.type, category: b.category, amount: b.amount }));
  if (data.length) await prisma.budget.createMany({ data, skipDuplicates: true });
  auditNote(`Copió ${data.length} partida(s) del presupuesto de ${MONTHS[prev.month - 1]} a ${MONTHS[month - 1]} ${year}`, `/contabilidad/presupuesto?anio=${year}&mes=${month}`);
  revalidatePath("/contabilidad/presupuesto");
}

export const saveBudget = safe(saveBudgetImpl, "contabilidad", "saveBudgetImpl");
export const copyPreviousBudget = safe(copyPreviousImpl, "contabilidad", "copyPreviousImpl");
