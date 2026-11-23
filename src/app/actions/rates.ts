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

/** Agrega como tarifas del cliente los conceptos que aún no tiene (por nombre), al final de su lista. */
async function addRates(
  clientId: number,
  rows: { code: string; name: string; description: string; wmsConcept: string; unit: string; unitPrice: number; priceText: string; atCost: boolean; taxRate: number }[],
  emptyMsg: string,
) {
  const existing = await prisma.clientRate.findMany({ where: { clientId }, select: { name: true, sortOrder: true } });
  const have = new Set(existing.map((r) => r.name.trim().toLowerCase()));
  const fresh = rows.filter((r) => !have.has(r.name.trim().toLowerCase()));
  if (!fresh.length) throw new Error(emptyMsg);
  const start = existing.reduce((a, r) => Math.max(a, r.sortOrder), 0) + 1;
  await prisma.clientRate.createMany({ data: fresh.map((r, n) => ({ ...r, clientId, sortOrder: start + n })) });
  refresh(clientId);
}

/** Clientes dados de alta a mano: parte del tarifario estándar (todo o una sección) y luego ajusta precios. */
async function copyRatesFromTariffImpl(clientId: number, fd: FormData) {
  const section = str(fd, "section");
  const services = await prisma.service.findMany({
    where: { active: true, ...(section ? { section } : {}) },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  if (!services.length) throw new Error("No hay servicios activos en el tarifario.");
  await addRates(
    clientId,
    services.map((s) => ({ code: s.code, name: s.name, description: s.description, wmsConcept: s.wmsConcept, unit: s.unit, unitPrice: s.unitPrice, priceText: s.priceText, atCost: s.atCost, taxRate: s.taxRate })),
    "El cliente ya tiene todas esas tarifas.",
  );
}

/** Copia las tarifas negociadas de otro cliente (las que este aún no tenga). */
async function copyRatesFromClientImpl(clientId: number, fd: FormData) {
  const fromId = numv(fd, "fromClientId");
  if (!fromId || fromId === clientId) throw new Error("Elige otro cliente.");
  const rates = await prisma.clientRate.findMany({ where: { clientId: fromId, active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  if (!rates.length) throw new Error("Ese cliente no tiene tarifas negociadas.");
  await addRates(
    clientId,
    rates.map((r) => ({ code: r.code, name: r.name, description: r.description, wmsConcept: r.wmsConcept, unit: r.unit, unitPrice: r.unitPrice, priceText: r.priceText, atCost: r.atCost, taxRate: r.taxRate })),
    "El cliente ya tiene todas las tarifas de ese cliente.",
  );
}

export const copyRatesFromTariff = safe(copyRatesFromTariffImpl, "clientes", "copyRatesFromTariffImpl");
export const copyRatesFromClient = safe(copyRatesFromClientImpl, "clientes", "copyRatesFromClientImpl");
export const createRate = safe(createRateImpl, "clientes", "createRateImpl");
export const updateRate = safe(updateRateImpl, "clientes", "updateRateImpl");
export const deleteRate = safe(deleteRateImpl, "clientes", "deleteRateImpl");
export const copyRatesFromQuote = safe(copyRatesFromQuoteImpl, "clientes", "copyRatesFromQuoteImpl");
