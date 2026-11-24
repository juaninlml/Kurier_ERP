"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays, formatMoney, fromInputDate, round2 } from "@/lib/money";
import { auditNote } from "@/lib/audit";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { numv, str } from "./helpers";
import { UserError } from "@/lib/user-error";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateInput(fd: FormData, k: string, label: string) {
  const v = str(fd, k);
  if (!DATE_RE.test(v)) throw new UserError("Escribe una fecha válida en {v0}.", { v0: label });
  return fromInputDate(v);
}

/** Datos de la cuenta por pagar capturados en el formulario (validados). */
async function billData(fd: FormData) {
  const supplierId = numv(fd, "supplierId");
  if (!supplierId) throw new Error("Selecciona un proveedor.");
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, creditDays: true } });
  if (!supplier) throw new Error("El proveedor ya no existe. Recarga la página.");
  const concept = str(fd, "concept");
  if (!concept) throw new Error("Escribe el concepto de la cuenta por pagar.");
  if (concept.length > 200) throw new Error("El concepto no puede pasar de 200 caracteres.");
  const folio = str(fd, "folio");
  if (folio.length > 60) throw new Error("El folio no puede pasar de 60 caracteres.");
  const category = str(fd, "category");
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) throw new Error("Selecciona una categoría de gasto.");
  const total = round2(numv(fd, "total"));
  if (total <= 0) throw new Error("El total debe ser mayor a 0.");
  const tax = round2(numv(fd, "tax"));
  if (tax < 0 || tax > total) throw new Error("El IVA debe estar entre 0 y el total.");
  const issueDate = dateInput(fd, "issueDate", "Fecha de la factura");
  // Sin vencimiento capturado: la fecha de la factura más los días de crédito del proveedor
  const dueDate = str(fd, "dueDate") ? dateInput(fd, "dueDate", "Vence") : addDays(issueDate, supplier.creditDays);
  if (dueDate < issueDate) throw new Error("El vencimiento no puede ser antes de la fecha de la factura.");
  return { supplierId, folio, concept, category, total, tax, issueDate, dueDate, notes: str(fd, "notes") };
}

/** Recalcula total pagado y estatus a partir de los pagos registrados. */
async function syncBill(tx: Prisma.TransactionClient, id: number) {
  const bill = await tx.supplierBill.findUniqueOrThrow({ where: { id }, include: { payments: { select: { amount: true } } } });
  const paid = round2(bill.payments.reduce((a, p) => a + p.amount, 0));
  let status = bill.status;
  if (status !== "CANCELADA") status = paid >= bill.total - 0.005 ? "PAGADA" : paid > 0 ? "PARCIAL" : "PENDIENTE";
  await tx.supplierBill.update({ where: { id }, data: { paidTotal: paid, status } });
}

function revalidateAll(id?: number, supplierId?: number) {
  revalidatePath("/");
  revalidatePath("/cuentas-por-pagar");
  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/reportes");
  revalidatePath("/proveedores");
  if (id) revalidatePath(`/cuentas-por-pagar/${id}`);
  if (supplierId) revalidatePath(`/proveedores/${supplierId}`);
}

async function createBillImpl(fd: FormData) {
  const data = await billData(fd);
  const bill = await prisma.supplierBill.create({ data, include: { supplier: { select: { name: true } } } });
  auditNote(`${bill.supplier.name}: ${bill.concept} · ${formatMoney(bill.total)}`, `/cuentas-por-pagar/${bill.id}`, bill.id);
  revalidateAll(undefined, data.supplierId);
  redirect(`/cuentas-por-pagar/${bill.id}`);
}

async function updateBillImpl(id: number, fd: FormData) {
  const bill = await prisma.supplierBill.findUniqueOrThrow({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (bill.status === "CANCELADA") throw new Error("La cuenta está cancelada; reactívala para editarla.");
  const data = await billData(fd);
  if (bill._count.payments > 0) {
    // Con pagos registrados solo se corrigen datos que no cambian lo ya pagado.
    if (data.supplierId !== bill.supplierId) throw new Error("No se puede cambiar el proveedor: ya tiene pagos registrados.");
    if (data.total < bill.paidTotal - 0.005) throw new UserError("El total no puede ser menor a lo ya pagado ({v0}).", { v0: bill.paidTotal.toFixed(2) });
  }
  await prisma.$transaction(async (tx) => {
    await tx.supplierBill.update({ where: { id }, data });
    await syncBill(tx, id);
  });
  auditNote(`${data.concept} · ${formatMoney(data.total)}${data.total !== bill.total ? ` (antes ${formatMoney(bill.total)})` : ""}`, `/cuentas-por-pagar/${id}`, id);
  revalidateAll(id, data.supplierId);
  if (data.supplierId !== bill.supplierId) revalidatePath(`/proveedores/${bill.supplierId}`);
}

async function addBillPaymentImpl(billId: number, fd: FormData) {
  const amount = round2(numv(fd, "amount"));
  if (amount <= 0) throw new Error("El monto debe ser mayor a 0.");
  const bill = await prisma.supplierBill.findUniqueOrThrow({ where: { id: billId }, include: { supplier: { select: { name: true } } } });
  if (bill.status === "CANCELADA") throw new Error("La cuenta está cancelada.");
  const balance = round2(bill.total - bill.paidTotal);
  if (amount > balance + 0.005) throw new UserError("El pago excede el saldo pendiente ({v0}).", { v0: balance.toFixed(2) });
  const date = dateInput(fd, "date", "Fecha");
  const method = str(fd, "method") || "Transferencia";
  const reference = str(fd, "reference");
  // IVA proporcional contenido en el pago
  const taxShare = bill.total > 0 ? round2(amount * (bill.tax / bill.total)) : 0;
  const label = bill.folio ? `${bill.folio} — ${bill.concept}` : bill.concept;

  await prisma.$transaction(async (tx) => {
    const p = await tx.supplierPayment.create({ data: { billId, amount, date, method, reference, notes: str(fd, "notes") } });
    await tx.transaction.create({
      data: {
        date,
        type: "EGRESO",
        category: bill.category,
        description: `Pago a ${bill.supplier.name}: ${label}`,
        amount,
        tax: taxShare,
        method,
        reference,
        supplierId: bill.supplierId,
        supplierPaymentId: p.id,
      },
    });
    await syncBill(tx, billId);
  });
  auditNote(`Pago de ${formatMoney(amount)} a ${bill.supplier.name}: ${label}`, `/cuentas-por-pagar/${billId}`, billId);
  revalidateAll(billId, bill.supplierId);
}

async function deleteBillPaymentImpl(paymentId: number) {
  const p = await prisma.supplierPayment.findUniqueOrThrow({ where: { id: paymentId }, include: { bill: { select: { supplierId: true, concept: true } } } });
  auditNote(`Eliminó el pago de ${formatMoney(p.amount)} de ${p.bill.concept}`, `/cuentas-por-pagar/${p.billId}`, p.billId);
  await prisma.$transaction(async (tx) => {
    // El egreso se borra en cascada con el pago; se borra explícito por claridad.
    await tx.transaction.deleteMany({ where: { supplierPaymentId: paymentId } });
    await tx.supplierPayment.delete({ where: { id: paymentId } });
    await syncBill(tx, p.billId);
  });
  revalidateAll(p.billId, p.bill.supplierId);
}

async function cancelBillImpl(id: number) {
  const bill = await prisma.supplierBill.findUniqueOrThrow({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (bill._count.payments > 0) throw new Error("Elimina primero los pagos registrados para cancelar la cuenta.");
  await prisma.supplierBill.update({ where: { id }, data: { status: "CANCELADA" } });
  auditNote(`${bill.concept} · ${formatMoney(bill.total)}`, `/cuentas-por-pagar/${id}`, id);
  revalidateAll(id, bill.supplierId);
}

async function reactivateBillImpl(id: number) {
  const bill = await prisma.supplierBill.findUniqueOrThrow({ where: { id } });
  await prisma.$transaction(async (tx) => {
    await tx.supplierBill.update({ where: { id }, data: { status: "PENDIENTE" } });
    await syncBill(tx, id);
  });
  revalidateAll(id, bill.supplierId);
}

async function deleteBillImpl(id: number) {
  const bill = await prisma.supplierBill.findUniqueOrThrow({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (bill._count.payments > 0) throw new Error("Elimina primero los pagos registrados para eliminar la cuenta.");
  await prisma.supplierBill.delete({ where: { id } });
  auditNote(`${bill.concept} · ${formatMoney(bill.total)}`, undefined, id);
  revalidateAll(undefined, bill.supplierId);
  redirect("/cuentas-por-pagar");
}

// Acciones públicas: los errores regresan como { error } para mostrarlos en el formulario.
export const createBill = safe(createBillImpl, "cxp", "createBillImpl");
export const updateBill = safe(updateBillImpl, "cxp", "updateBillImpl");
export const addBillPayment = safe(addBillPaymentImpl, "cxp", "addBillPaymentImpl");
export const deleteBillPayment = safe(deleteBillPaymentImpl, "cxp", "deleteBillPaymentImpl");
export const cancelBill = safe(cancelBillImpl, "cxp", "cancelBillImpl");
export const reactivateBill = safe(reactivateBillImpl, "cxp", "reactivateBillImpl");
export const deleteBill = safe(deleteBillImpl, "cxp", "deleteBillImpl");
