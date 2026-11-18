"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeLines } from "@/lib/totals";
import { addDays, fromInputDate } from "@/lib/money";
import { getSettings, nextFolio } from "@/lib/settings";
import { QUOTE_STATUSES } from "@/lib/constants";
import { numv, parseItems, str } from "./helpers";

function header(fd: FormData) {
  const clientId = numv(fd, "clientId");
  if (!clientId) throw new Error("Selecciona un cliente.");
  return {
    clientId,
    issueDate: fromInputDate(str(fd, "issueDate")),
    validUntil: fromInputDate(str(fd, "secondDate")),
    notes: str(fd, "notes"),
    terms: str(fd, "terms"),
  };
}

type ItemRow = { id: number; position: number; code: string; description: string; unit: string; quantity: number; unitPrice: number; discountPct: number; taxRate: number; amount: number };
const copyItem = (it: ItemRow) => ({
  position: it.position,
  code: it.code,
  description: it.description,
  unit: it.unit,
  quantity: it.quantity,
  unitPrice: it.unitPrice,
  discountPct: it.discountPct,
  taxRate: it.taxRate,
  amount: it.amount,
});

export async function createQuote(fd: FormData) {
  const h = header(fd);
  const { items, ...totals } = computeLines(parseItems(fd));
  const q = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, "quote");
    return tx.quote.create({ data: { ...h, ...totals, folio, items: { create: items } } });
  });
  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${q.id}`);
}

export async function updateQuote(id: number, fd: FormData) {
  const current = await prisma.quote.findUniqueOrThrow({ where: { id } });
  if (current.status === "FACTURADA") throw new Error("Una cotización facturada no se puede editar.");
  const h = header(fd);
  const { items, ...totals } = computeLines(parseItems(fd));
  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
    prisma.quote.update({ where: { id }, data: { ...h, ...totals, items: { create: items } } }),
  ]);
  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${id}`);
}

export async function setQuoteStatus(id: number, status: string) {
  if (!(QUOTE_STATUSES as readonly string[]).includes(status) || status === "FACTURADA") throw new Error("Estatus inválido");
  await prisma.quote.update({ where: { id }, data: { status } });
  revalidatePath(`/cotizaciones/${id}`);
  revalidatePath("/cotizaciones");
}

export async function duplicateQuote(id: number) {
  const src = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { items: true } });
  const s = await getSettings();
  const now = new Date();
  const q = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, "quote");
    return tx.quote.create({
      data: {
        folio,
        clientId: src.clientId,
        issueDate: now,
        validUntil: addDays(now, s.quoteValidityDays),
        notes: src.notes,
        terms: src.terms,
        subtotal: src.subtotal,
        discount: src.discount,
        tax: src.tax,
        total: src.total,
        items: { create: src.items.map(copyItem) },
      },
    });
  });
  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${q.id}`);
}

export async function deleteQuote(id: number) {
  const q = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { _count: { select: { invoices: true } } } });
  if (q._count.invoices > 0) throw new Error("No se puede eliminar: la cotización ya tiene facturas.");
  await prisma.quote.delete({ where: { id } });
  revalidatePath("/cotizaciones");
  redirect("/cotizaciones");
}

/** Convierte una cotización en factura copiando conceptos y totales. */
export async function convertQuoteToInvoice(id: number) {
  const q = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { items: true } });
  if (q.status === "FACTURADA") throw new Error("Esta cotización ya fue facturada.");
  const s = await getSettings();
  const now = new Date();
  const inv = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, "invoice");
    const created = await tx.invoice.create({
      data: {
        folio,
        clientId: q.clientId,
        quoteId: q.id,
        issueDate: now,
        dueDate: addDays(now, s.paymentTermsDays),
        notes: s.invoiceNotes,
        subtotal: q.subtotal,
        discount: q.discount,
        tax: q.tax,
        total: q.total,
        items: { create: q.items.map(copyItem) },
      },
    });
    await tx.quote.update({ where: { id }, data: { status: "FACTURADA" } });
    return created;
  });
  revalidatePath("/cotizaciones");
  revalidatePath("/facturas");
  redirect(`/facturas/${inv.id}`);
}
