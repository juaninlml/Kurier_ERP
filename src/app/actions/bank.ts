"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { auditNote } from "@/lib/audit";
import { decodeBankFile, parseBankCsv, suggestMatches } from "@/lib/bank-csv";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { formatMoney, round2 } from "@/lib/money";
import { numv, str } from "./helpers";

const MAX_BYTES = 2 * 1024 * 1024;
const DAY = 86_400_000;

function revalidate(importId?: number) {
  revalidatePath("/contabilidad/conciliacion");
  if (importId) revalidatePath(`/contabilidad/conciliacion/${importId}`);
  revalidatePath("/contabilidad");
}

/** Liga automáticamente los renglones pendientes con su movimiento (mismo importe y fecha cercana). */
async function autoMatch(importId: number) {
  const lines = await prisma.bankLine.findMany({ where: { importId, transactionId: null, ignored: false } });
  if (!lines.length) return 0;
  const min = new Date(Math.min(...lines.map((l) => l.date.getTime())) - 6 * DAY);
  const max = new Date(Math.max(...lines.map((l) => l.date.getTime())) + 6 * DAY);
  const txs = await prisma.transaction.findMany({
    where: { date: { gte: min, lte: max }, bankLine: null },
    select: { id: true, date: true, amount: true, type: true },
  });
  const matches = suggestMatches(lines, txs);
  // Uno por uno: si otro proceso ya tomó el movimiento, la llave única lo impide y se sigue con el resto
  let n = 0;
  for (const [lineId, tx] of matches) {
    const ok = await prisma.bankLine.updateMany({ where: { id: lineId, transactionId: null }, data: { transactionId: tx.id } }).catch(() => ({ count: 0 }));
    n += ok.count;
  }
  return n;
}

async function importStatementImpl(fd: FormData) {
  const me = await getCurrentUser();
  const name = str(fd, "name");
  if (!name) throw new Error("Escribe el nombre de la cuenta (p. ej. BBVA 1234).");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecciona el archivo CSV del estado de cuenta.");
  if (file.size > MAX_BYTES) throw new Error("El archivo pasa de 2 MB.");
  if (!/\.(csv|txt)$/i.test(file.name)) throw new Error("Sube el estado de cuenta en formato CSV (exportado desde la banca en línea).");
  const parsed = parseBankCsv(decodeBankFile(new Uint8Array(await file.arrayBuffer())));
  if (parsed.error) throw new Error(parsed.error);
  const rows = parsed.rows!;
  const dates = rows.map((r) => r.date.getTime());
  const imp = await prisma.bankImport.create({
    data: {
      name: name.slice(0, 80),
      fileName: file.name.slice(0, 120),
      fromDate: new Date(Math.min(...dates)),
      toDate: new Date(Math.max(...dates)),
      createdBy: me.name || me.email,
      lines: { create: rows },
    },
  });
  const matched = await autoMatch(imp.id);
  auditNote(`Estado de cuenta ${imp.name}: ${rows.length} movimientos, ${matched} conciliados automáticamente`, `/contabilidad/conciliacion/${imp.id}`, imp.id);
  revalidate();
  redirect(`/contabilidad/conciliacion/${imp.id}`);
}

async function autoMatchImpl(importId: number) {
  const n = await autoMatch(importId);
  auditNote(`Conciliación automática: ${n} renglón(es) ligados`, `/contabilidad/conciliacion/${importId}`, importId);
  revalidate(importId);
}

async function matchLineImpl(lineId: number, transactionId: number) {
  const line = await prisma.bankLine.findUniqueOrThrow({ where: { id: lineId } });
  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId }, include: { bankLine: { select: { id: true } } } });
  if (tx.bankLine && tx.bankLine.id !== lineId) throw new Error("Ese movimiento ya está conciliado con otro renglón del banco.");
  if ((line.amount > 0 ? "INGRESO" : "EGRESO") !== tx.type) throw new Error("El sentido no coincide: un depósito se concilia con un ingreso y un retiro con un egreso.");
  await prisma.bankLine.update({ where: { id: lineId }, data: { transactionId, ignored: false } });
  auditNote(`Concilió ${formatMoney(Math.abs(line.amount))} del banco con el movimiento #${transactionId}`, `/contabilidad/conciliacion/${line.importId}`, line.importId);
  revalidate(line.importId);
}

async function unmatchLineImpl(lineId: number) {
  const line = await prisma.bankLine.update({ where: { id: lineId }, data: { transactionId: null } });
  auditNote(`Deshizo la conciliación de ${formatMoney(Math.abs(line.amount))}`, `/contabilidad/conciliacion/${line.importId}`, line.importId);
  revalidate(line.importId);
}

async function toggleIgnoreImpl(lineId: number) {
  const line = await prisma.bankLine.findUniqueOrThrow({ where: { id: lineId } });
  await prisma.bankLine.update({ where: { id: lineId }, data: { ignored: !line.ignored, transactionId: null } });
  revalidate(line.importId);
}

/** Crea en contabilidad el movimiento que falta (p. ej. una comisión bancaria) y lo concilia. */
async function createFromLineImpl(lineId: number, fd: FormData) {
  const line = await prisma.bankLine.findUniqueOrThrow({ where: { id: lineId } });
  if (line.transactionId) throw new Error("Este renglón ya está conciliado.");
  const type = line.amount > 0 ? "INGRESO" : "EGRESO";
  const category = str(fd, "category");
  const valid = (type === "INGRESO" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES) as readonly string[];
  if (!valid.includes(category)) throw new Error("Selecciona una categoría.");
  const amount = round2(Math.abs(line.amount));
  const tax = round2(numv(fd, "tax"));
  if (tax < 0 || tax > amount) throw new Error("El IVA debe estar entre 0 y el monto.");
  const clientId = type === "INGRESO" ? numv(fd, "clientId") || null : null;
  const supplierId = type === "EGRESO" ? numv(fd, "supplierId") || null : null;
  await prisma.$transaction(async (db) => {
    const tx = await db.transaction.create({
      data: {
        date: line.date,
        type,
        category,
        description: str(fd, "description") || line.description || "Movimiento bancario",
        amount,
        tax,
        method: "Transferencia",
        reference: line.reference,
        clientId,
        supplierId,
      },
    });
    await db.bankLine.update({ where: { id: lineId }, data: { transactionId: tx.id, ignored: false } });
  });
  auditNote(`${type === "INGRESO" ? "Ingreso" : "Egreso"} de ${formatMoney(amount)} desde el banco · ${category}`, `/contabilidad/conciliacion/${line.importId}`, line.importId);
  revalidate(line.importId);
}

async function deleteStatementImpl(importId: number) {
  const imp = await prisma.bankImport.delete({ where: { id: importId } });
  auditNote(`Estado de cuenta ${imp.name} (${imp.fileName})`, undefined, importId);
  revalidate();
  redirect("/contabilidad/conciliacion");
}

export const importStatement = safe(importStatementImpl, "conciliacion", "importStatementImpl");
export const runAutoMatch = safe(autoMatchImpl, "conciliacion", "autoMatchImpl");
export const matchLine = safe(matchLineImpl, "conciliacion", "matchLineImpl");
export const unmatchLine = safe(unmatchLineImpl, "conciliacion", "unmatchLineImpl");
export const toggleIgnoreLine = safe(toggleIgnoreImpl, "conciliacion", "toggleIgnoreImpl");
export const createFromLine = safe(createFromLineImpl, "conciliacion", "createFromLineImpl");
export const deleteStatement = safe(deleteStatementImpl, "conciliacion", "deleteStatementImpl");
