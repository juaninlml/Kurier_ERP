import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export async function getSettings() {
  return prisma.companySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Reserva el siguiente folio dentro de una transacción para evitar duplicados. */
export async function nextFolio(tx: Prisma.TransactionClient, kind: "quote" | "invoice") {
  await tx.companySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const s = await tx.companySettings.update({
    where: { id: 1 },
    data: kind === "quote" ? { nextQuoteNumber: { increment: 1 } } : { nextInvoiceNumber: { increment: 1 } },
  });
  const n = (kind === "quote" ? s.nextQuoteNumber : s.nextInvoiceNumber) - 1;
  const prefix = kind === "quote" ? s.quotePrefix : s.invoicePrefix;
  return `${prefix}-${String(n).padStart(5, "0")}`;
}
