"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromInputDate, round2 } from "@/lib/money";
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

async function createTransactionImpl(fd: FormData) {
  await prisma.transaction.create({ data: txData(fd) });
  revalidate();
  redirect("/contabilidad");
}

async function updateTransactionImpl(id: number, fd: FormData) {
  const t = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (t.paymentId) throw new Error("Este movimiento proviene de un pago de factura; edítalo desde la factura.");
  await prisma.transaction.update({ where: { id }, data: txData(fd) });
  revalidate();
  redirect("/contabilidad");
}

async function deleteTransactionImpl(id: number) {
  const t = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (t.paymentId) throw new Error("Este movimiento proviene de un pago de factura; elimina el pago desde la factura.");
  await prisma.transaction.delete({ where: { id } });
  revalidate();
  redirect("/contabilidad");
}

// Acciones públicas: los errores regresan como { error } para mostrarlos en el formulario.
export const createTransaction = safe(createTransactionImpl);
export const updateTransaction = safe(updateTransactionImpl);
export const deleteTransaction = safe(deleteTransactionImpl);
