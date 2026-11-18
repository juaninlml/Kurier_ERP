import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/** Configuración para pantallas (sin los bytes del logo). */
export async function getSettings() {
  return prisma.companySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 }, omit: { logoData: true } });
}

/** Configuración completa, incluyendo el logo (para PDFs). */
export async function getSettingsWithLogo() {
  return prisma.companySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function hasLogo() {
  const r = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { logoMime: true } });
  return Boolean(r?.logoMime);
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
