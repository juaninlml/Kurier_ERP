"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatMoney, fromInputDate, round2 } from "@/lib/money";
import { auditNote } from "@/lib/audit";
import { numv, str } from "./helpers";

function txData(fd: FormData) {
  const type = str(fd, "type");
  if (type !== "INGRESO" && type !== "EGRESO") throw new Error("Tipo inválido.");
  const amount = round2(numv(fd, "amount"));
  if (amount <= 0) throw new Error("El monto debe ser mayor a 0.");
  const category = str(fd, "category");
  if (!category) throw new Error("Selecciona una categoría.");
  const tax = round2(numv(fd, "tax"));
  if (tax < 0 || tax > amount) throw new Error("El IVA debe estar entre 0 y el monto total.");
  // Ingreso → cliente que pagó; egreso → proveedor al que se le pagó.
  const clientId = type === "INGRESO" ? numv(fd, "clientId") : 0;
  const supplierId = type === "EGRESO" ? numv(fd, "supplierId") : 0;
  return {
    type,
    category,
    amount,
    tax,
    date: fromInputDate(str(fd, "date")),
    description: str(fd, "description"),
    method: str(fd, "method") || "Transferencia",
    reference: str(fd, "reference"),
    clientId: clientId || null,
    supplierId: supplierId || null,
  };
}

function revalidate() {
  revalidatePath("/contabilidad");
  revalidatePath("/proveedores", "layout");
  revalidatePath("/contabilidad/reportes");
  revalidatePath("/");
}

const describe = (t: { type: string; amount: number; category: string; description: string }) =>
  `${t.type === "INGRESO" ? "Ingreso" : "Egreso"} de ${formatMoney(t.amount)} · ${t.category}${t.description ? ` · ${t.description}` : ""}`;

async function createTransactionImpl(fd: FormData) {
  const t = await prisma.transaction.create({ data: txData(fd) });
  auditNote(describe(t), `/contabilidad/movimientos/${t.id}`, t.id);
  revalidate();
  redirect("/contabilidad");
}

async function updateTransactionImpl(id: number, fd: FormData) {
  const t = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (t.paymentId) throw new Error("Este movimiento proviene de un pago de factura; edítalo desde la factura.");
  if (t.supplierPaymentId) throw new Error("Este movimiento proviene de un pago a proveedor; edítalo desde su cuenta por pagar.");
  const u = await prisma.transaction.update({ where: { id }, data: txData(fd) });
  auditNote(`${describe(u)} (antes ${formatMoney(t.amount)})`, `/contabilidad/movimientos/${id}`, id);
  revalidate();
  redirect("/contabilidad");
}

async function deleteTransactionImpl(id: number) {
  const t = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (t.paymentId) throw new Error("Este movimiento proviene de un pago de factura; elimina el pago desde la factura.");
  if (t.supplierPaymentId) throw new Error("Este movimiento proviene de un pago a proveedor; elimina el pago desde su cuenta por pagar.");
  await prisma.transaction.delete({ where: { id } });
  auditNote(describe(t), undefined, id);
  revalidate();
  redirect("/contabilidad");
}

// Acciones públicas: los errores regresan como { error } para mostrarlos en el formulario.
export const createTransaction = safe(createTransactionImpl, "contabilidad", "createTransactionImpl");
export const updateTransaction = safe(updateTransactionImpl, "contabilidad", "updateTransactionImpl");
export const deleteTransaction = safe(deleteTransactionImpl, "contabilidad", "deleteTransactionImpl");
