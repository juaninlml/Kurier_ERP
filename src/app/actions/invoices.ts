"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeLines } from "@/lib/totals";
import { fromInputDate, round2 } from "@/lib/money";
import { auditNote } from "@/lib/audit";
import { nextFolio } from "@/lib/settings";
import { numv, parseItems, str } from "./helpers";
import { queueArchive } from "@/lib/archive";
import { brandPrefix } from "@/lib/brands";
import { UserError } from "@/lib/user-error";
import { currencyOf, exchangeRateLabel, formatCurrency, toMxn } from "@/lib/currency";

/** Moneda de la factura y tipo de cambio (MXN por 1 CNY). En MXN el tipo de cambio es 1. */
function currencyInput(fd: FormData) {
  const currency = currencyOf(str(fd, "currency"));
  if (currency === "MXN") return { currency, exchangeRate: 1 };
  const exchangeRate = Math.round(numv(fd, "exchangeRate") * 10000) / 10000;
  if (!(exchangeRate > 0)) throw new Error("Captura el tipo de cambio (pesos por 1 yuan).");
  if (exchangeRate > 1000) throw new Error("El tipo de cambio no parece correcto: son pesos mexicanos por 1 yuan.");
  return { currency, exchangeRate };
}

function header(fd: FormData) {
  const clientId = numv(fd, "clientId");
  if (!clientId) throw new Error("Selecciona un cliente.");
  return {
    ...currencyInput(fd),
    clientId,
    issueDate: fromInputDate(str(fd, "issueDate")),
    dueDate: fromInputDate(str(fd, "secondDate")),
    notes: str(fd, "notes"),
    period: str(fd, "period"),
    volume: str(fd, "volume"),
    storage: str(fd, "storage"),
    terms: str(fd, "terms"),
    brandId: numv(fd, "brandId") || null,
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

/** Folio capturado a mano (vacío = automático). */
function folioInput(fd: FormData) {
  const f = str(fd, "folio").replace(/\s+/g, " ");
  if (f.length > 40) throw new Error("El folio no puede pasar de 40 caracteres.");
  if (f && !/^[\p{L}\p{N}][\p{L}\p{N} ._\-/#]*$/u.test(f)) throw new Error("El folio solo puede llevar letras, números, espacios y . - _ / #");
  return f;
}

async function assertFolioFree(db: Pick<Prisma.TransactionClient, "invoice">, folio: string, exceptId?: number) {
  const dup = await db.invoice.findFirst({ where: { folio, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
  if (dup) throw new UserError("Ya existe una factura con el folio {v0}.", { v0: folio });
}

async function createInvoiceImpl(fd: FormData) {
  const h = header(fd);
  const { items, ...totals } = computeLines(parseItems(fd, "invoice"));
  const quoteId = numv(fd, "quoteId") || null;
  const importId = numv(fd, "importId") || null;
  const ordersWeek = /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "ordersWeek")) ? str(fd, "ordersWeek") : "";
  const custom = folioInput(fd);
  const inv = await prisma.$transaction(async (tx) => {
    if (ordersWeek) {
      const dup = await tx.invoice.findFirst({ where: { clientId: h.clientId, ordersWeek, status: { not: "CANCELADA" } } });
      if (dup) throw new UserError("Las órdenes de esa semana ya se facturaron en {v0}.", { v0: dup.folio });
    }
    if (importId) {
      const imp = await tx.wmsImport.findUnique({ where: { id: importId } });
      if (imp?.status === "FACTURADO") throw new UserError("El estado de cobro {v0} ya se facturó.", { v0: imp.folio });
    }
    if (custom) await assertFolioFree(tx, custom);
    // Folio capturado (serie propia del cliente) o el consecutivo automático
    const folio = custom || (await nextFolio(tx, "invoice", await brandPrefix(h.brandId, "invoice")));
    const created = await tx.invoice.create({ data: { ...h, ...totals, folio, quoteId, ordersWeek, items: { create: items } } });
    if (quoteId) await tx.quote.update({ where: { id: quoteId }, data: { status: "FACTURADA" } });
    if (importId) await tx.wmsImport.update({ where: { id: importId }, data: { status: "FACTURADO", invoiceId: created.id } });
    return created;
  });
  revalidateAll();
  revalidatePath("/cotizaciones");
  revalidatePath("/facturas/importar");
  if (ordersWeek) revalidatePath("/ordenes");
  queueArchive(`factura:${inv.id}`, ...(ordersWeek ? [`ordenes:${h.clientId}:${ordersWeek}`] : []));
  redirect(`/facturas/${inv.id}`);
}

async function updateInvoiceImpl(id: number, fd: FormData) {
  const current = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (current._count.payments > 0) throw new Error("No se puede editar una factura con pagos registrados.");
  if (current.status === "CANCELADA") throw new Error("No se puede editar una factura cancelada.");
  const h = header(fd);
  const { items, ...totals } = computeLines(parseItems(fd, "invoice"));
  const folio = folioInput(fd) || current.folio;
  if (folio !== current.folio) await assertFolioFree(prisma, folio, id);
  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({ where: { id }, data: { ...h, ...totals, folio, items: { create: items } } }),
  ]);
  revalidateAll(id);
  queueArchive(`factura:${id}`);
  auditNote(`Factura ${folio}: ${formatCurrency(totals.total, h.currency)}`, `/facturas/${id}`, id);
  redirect(`/facturas/${id}`);
}

async function addPaymentImpl(invoiceId: number, fd: FormData) {
  const amount = round2(numv(fd, "amount"));
  if (amount <= 0) throw new Error("El monto debe ser mayor a 0.");
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { client: true } });
  if (inv.status === "CANCELADA") throw new Error("La factura está cancelada.");
  const balance = round2(inv.total - inv.paidTotal);
  if (amount > balance + 0.005) throw new UserError("El pago excede el saldo pendiente ({v0}).", { v0: formatCurrency(balance, inv.currency) });
  const date = fromInputDate(str(fd, "date"));
  const method = str(fd, "method") || "Transferencia";
  const reference = str(fd, "reference");
  // IVA proporcional contenido en el pago
  const taxShare = inv.total > 0 ? round2(amount * (inv.tax / inv.total)) : 0;
  // El pago queda en la moneda de la factura; el movimiento de contabilidad, siempre en MXN.
  const cny = inv.currency === "CNY";
  const fxNote = cny ? ` (${formatCurrency(amount, "CNY")} CNY · ${exchangeRateLabel(inv.exchangeRate)})` : "";

  await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: { invoiceId, amount, date, method, reference, notes: str(fd, "notes") },
    });
    await tx.transaction.create({
      data: {
        date,
        type: "INGRESO",
        category: "Cobro de facturas",
        description: `Pago factura ${inv.folio} — ${inv.client.name}${fxNote}`,
        amount: toMxn(amount, inv),
        tax: toMxn(taxShare, inv),
        method,
        reference,
        clientId: inv.clientId,
        paymentId: p.id,
      },
    });
    await syncInvoice(tx, invoiceId);
  });
  revalidateAll(invoiceId);
  queueArchive(`factura:${invoiceId}`);
  auditNote(`Cobro de ${formatCurrency(amount, inv.currency)} a ${inv.folio} — ${inv.client.name}`, `/facturas/${invoiceId}`, invoiceId);
}

async function deletePaymentImpl(paymentId: number) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: { select: { folio: true, currency: true } } } });
  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { paymentId } });
    await tx.payment.delete({ where: { id: paymentId } });
    await syncInvoice(tx, p.invoiceId);
  });
  revalidateAll(p.invoiceId);
  queueArchive(`factura:${p.invoiceId}`);
  auditNote(`Eliminó el cobro de ${formatCurrency(p.amount, p.invoice.currency)} de ${p.invoice.folio}`, `/facturas/${p.invoiceId}`, p.invoiceId);
}

async function cancelInvoiceImpl(id: number) {
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (inv._count.payments > 0) throw new Error("Elimina primero los pagos registrados para cancelar la factura.");
  await prisma.$transaction([
    prisma.invoice.update({ where: { id }, data: { status: "CANCELADA" } }),
    // El estado de cobro del WMS vuelve a quedar disponible para facturarse de nuevo.
    prisma.wmsImport.updateMany({ where: { invoiceId: id }, data: { status: "PENDIENTE", invoiceId: null } }),
  ]);
  revalidateAll(id);
  revalidatePath("/facturas/importar");
  queueArchive(`factura:${id}`);
  auditNote(`Factura ${inv.folio} (${formatCurrency(inv.total, inv.currency)})`, `/facturas/${id}`, id);
}

async function reactivateInvoiceImpl(id: number) {
  const inv = await prisma.invoice.findUniqueOrThrow({ where: { id }, select: { folio: true } });
  auditNote(`Factura ${inv.folio}`, `/facturas/${id}`, id);
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status: "PENDIENTE" } });
    await syncInvoice(tx, id);
  });
  revalidateAll(id);
  queueArchive(`factura:${id}`);
}

// Acciones públicas: los errores regresan como { error } para mostrarlos en el formulario.
export const createInvoice = safe(createInvoiceImpl, "facturas", "createInvoiceImpl");
export const updateInvoice = safe(updateInvoiceImpl, "facturas", "updateInvoiceImpl");
export const addPayment = safe(addPaymentImpl, "facturas", "addPaymentImpl");
export const deletePayment = safe(deletePaymentImpl, "facturas", "deletePaymentImpl");
export const cancelInvoice = safe(cancelInvoiceImpl, "facturas", "cancelInvoiceImpl");
export const reactivateInvoice = safe(reactivateInvoiceImpl, "facturas", "reactivateInvoiceImpl");
