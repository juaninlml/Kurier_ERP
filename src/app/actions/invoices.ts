"use server";

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeLines } from "@/lib/totals";
import { fromInputDate, round2 } from "@/lib/money";
import { nextFolio } from "@/lib/settings";
import { numv, parseItems, str } from "./helpers";

function header(fd: FormData) {
  const clientId = numv(fd, "clientId");
  if (!clientId) throw new Error("Selecciona un cliente.");
  return {
    clientId,
    issueDate: fromInputDate(str(fd, "issueDate")),
    dueDate: fromInputDate(str(fd, "secondDate")),
    notes: str(fd, "notes"),
  };
}

function revalidateAll(id?: number) {
  revalidatePath("/");
  revalidatePath("/facturas");
  revalidatePath("/contabilidad");
  if (id) revalidatePath(`/facturas/${id}`);
}

/** Recalcula total pagado y estatus a partir de los pagos registrados. */
async function syncInvoice(tx: Prisma.TransactionClient, id: number) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
  const paid = round2(inv.payments.reduce((a, p) => a + p.amount, 0));
  let status = inv.status;
  if (status !== "CANCELADA") status = paid >= inv.total - 0.005 ? "PAGADA" : paid > 0 ? "PARCIAL" : "PENDIENTE";
  await tx.invoice.update({ where: { id }, data: { paidTotal: paid, status } });
}

export async function createInvoice(fd: FormData) {
  const h = header(fd);
  const { items, ...totals } = computeLines(parseItems(fd));
  const inv = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, "invoice");
    return tx.invoice.create({ data: { ...h, ...totals, folio, items: { create: items } } });
  });
  revalidateAll();
  redirect(`/facturas/${inv.id}`);
}

export async function updateInvoice(id: number, fd: FormData) {
  const current = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (current._count.payments > 0) throw new Error("No se puede editar una factura con pagos registrados.");
  if (current.status === "CANCELADA") throw new Error("No se puede editar una factura cancelada.");
  const h = header(fd);
  const { items, ...totals } = computeLines(parseItems(fd));
  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({ where: { id }, data: { ...h, ...totals, items: { create: items } } }),
  ]);
  revalidateAll(id);
  redirect(`/facturas/${id}`);
}

export async function addPayment(invoiceId: number, fd: FormData) {
  const amount = round2(numv(fd, "amount"));
  if (amount <= 0) throw new Error("El monto debe ser mayor a 0.");
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { client: true } });
  if (inv.status === "CANCELADA") throw new Error("La factura está cancelada.");
  const balance = round2(inv.total - inv.paidTotal);
  if (amount > balance + 0.005) throw new Error(`El pago excede el saldo pendiente (${balance.toFixed(2)}).`);
  const date = fromInputDate(str(fd, "date"));
  const method = str(fd, "method") || "Transferencia";
  const reference = str(fd, "reference");
  // IVA proporcional contenido en el pago
  const taxShare = inv.total > 0 ? round2(amount * (inv.tax / inv.total)) : 0;

  await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: { invoiceId, amount, date, method, reference, notes: str(fd, "notes") },
    });
    await tx.transaction.create({
      data: {
        date,
        type: "INGRESO",
        category: "Cobro de facturas",
        description: `Pago factura ${inv.folio} — ${inv.client.name}`,
        amount,
        tax: taxShare,
        method,
        reference,
        clientId: inv.clientId,
        paymentId: p.id,
      },
    });
    await syncInvoice(tx, invoiceId);
  });
  revalidateAll(invoiceId);
}

export async function deletePayment(paymentId: number) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { paymentId } });
    await tx.payment.delete({ where: { id: paymentId } });
    await syncInvoice(tx, p.invoiceId);
  });
  revalidateAll(p.invoiceId);
}

export async function cancelInvoice(id: number) {
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (inv._count.payments > 0) throw new Error("Elimina primero los pagos registrados para cancelar la factura.");
  await prisma.invoice.update({ where: { id }, data: { status: "CANCELADA" } });
  revalidateAll(id);
}

export async function reactivateInvoice(id: number) {
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status: "PENDIENTE" } });
    await syncInvoice(tx, id);
  });
  revalidateAll(id);
}
