"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { numv, str } from "./helpers";

function rateData(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("La tarifa necesita un nombre.");
  const unitPrice = numv(fd, "unitPrice");
  if (unitPrice < 0) throw new Error("El precio no puede ser negativo.");
  return {
    code: str(fd, "code").toUpperCase(),
    name,
    description: str(fd, "description"),
    wmsConcept: str(fd, "wmsConcept"),
    unit: str(fd, "unit") || "Servicio",
    unitPrice,
    priceText: str(fd, "priceText"),
    atCost: fd.get("atCost") === "on",
    taxRate: numv(fd, "taxRate", 16),
  };
}

const refresh = (clientId: number) => {
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/facturas/importar", "layout");
};

async function createRateImpl(clientId: number, fd: FormData) {
  const last = await prisma.clientRate.aggregate({ where: { clientId }, _max: { sortOrder: true } });
  await prisma.clientRate.create({ data: { ...rateData(fd), clientId, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  refresh(clientId);
}

async function updateRateImpl(id: number, fd: FormData) {
  const r = await prisma.clientRate.update({ where: { id }, data: { ...rateData(fd), active: fd.get("active") !== "off" } });
  refresh(r.clientId);
}

async function deleteRateImpl(id: number) {
  const r = await prisma.clientRate.delete({ where: { id } });
  refresh(r.clientId);
}

/** Copia como tarifas del cliente los conceptos de una de sus cotizaciones (los que tienen precio). */
async function copyRatesFromQuoteImpl(clientId: number, fd: FormData) {
  const quoteId = numv(fd, "quoteId");
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, clientId }, include: { items: { orderBy: { position: "asc" } } } });
  if (!quote) throw new Error("Selecciona una cotización del cliente.");
  const [existing, services] = await Promise.all([
    prisma.clientRate.findMany({ where: { clientId } }),
    prisma.service.findMany({ select: { code: true, wmsConcept: true } }),
  ]);
  const have = new Set(existing.map((r) => r.name.toLowerCase()));
  const wmsByCode = new Map(services.map((s) => [s.code, s.wmsConcept]));
  const items = quote.items.filter((i) => (i.unitPrice > 0 || i.atCost) && !have.has(i.description.toLowerCase()));
  if (!items.length) throw new Error("No hay conceptos nuevos con precio en esa cotización.");
  const start = (existing.reduce((a, r) => Math.max(a, r.sortOrder), 0) ?? 0) + 1;
  await prisma.clientRate.createMany({
    data: items.map((i, n) => ({
      clientId,
      code: i.code,
      name: i.description,
      description: i.detail,
      wmsConcept: wmsByCode.get(i.code) ?? "",
      unit: i.unit,
      unitPrice: i.unitPrice,
      priceText: i.priceText,
      atCost: i.atCost,
      taxRate: i.taxRate,
      sortOrder: start + n,
    })),
  });
  refresh(clientId);
}

export const createRate = safe(createRateImpl);
export const updateRate = safe(updateRateImpl);
export const deleteRate = safe(deleteRateImpl);
export const copyRatesFromQuote = safe(copyRatesFromQuoteImpl);
