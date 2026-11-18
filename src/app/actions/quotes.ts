"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeLines } from "@/lib/totals";
import { addDays, fromInputDate } from "@/lib/money";
import { getSettings, nextFolio } from "@/lib/settings";
import { QUOTE_STATUSES } from "@/lib/constants";
import { numv, parseItems, parsePerOrderForm, parseProfile, str } from "./helpers";
import { parseVolumes } from "@/lib/quote-extras";

function header(fd: FormData) {
  const forClient = str(fd, "partyType") === "client";
  const clientId = forClient ? numv(fd, "clientId") : 0;
  if (forClient && !clientId) throw new Error("Selecciona el cliente.");
  const prospectName = str(fd, "prospectName");
  if (!forClient && !prospectName) throw new Error("Escribe el nombre del prospecto (empresa o marca).");
  return {
    clientId: clientId || null,
    prospectName: forClient ? "" : prospectName,
    prospectLegalName: forClient ? "" : str(fd, "prospectLegalName"),
    prospectRfc: forClient ? "" : str(fd, "prospectRfc").toUpperCase(),
    prospectEmail: forClient ? "" : str(fd, "prospectEmail"),
    prospectPhone: forClient ? "" : str(fd, "prospectPhone"),
    issueDate: fromInputDate(str(fd, "issueDate")),
    validUntil: fromInputDate(str(fd, "secondDate")),
    notes: str(fd, "notes"),
    terms: str(fd, "terms"),
    attention: str(fd, "attention"),
    profile: JSON.stringify(parseProfile(fd)),
    perOrder: JSON.stringify(parsePerOrderForm(fd)),
    perOrderFee: Math.max(0, numv(fd, "perOrderFee")),
    baseVolume: Math.max(0, numv(fd, "baseVolume")),
    scenarios: parseVolumes(str(fd, "scenarios")).join(", "),
  };
}

type ItemRow = {
  id: number;
  position: number;
  code: string;
  description: string;
  detail: string;
  section: string;
  priceText: string;
  atCost: boolean;
  scales: boolean;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  amount: number;
};
const copyItem = (it: ItemRow) => ({
  position: it.position,
  code: it.code,
  description: it.description,
  detail: it.detail,
  section: it.section,
  priceText: it.priceText,
  atCost: it.atCost,
  scales: it.scales,
  unit: it.unit,
  quantity: it.quantity,
  unitPrice: it.unitPrice,
  discountPct: it.discountPct,
  taxRate: it.taxRate,
  amount: it.amount,
});

async function createQuoteImpl(fd: FormData) {
  const h = header(fd);
  const { items, ...totals } = computeLines(parseItems(fd, "quote"));
  const q = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, "quote");
    return tx.quote.create({ data: { ...h, ...totals, folio, items: { create: items } } });
  });
  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${q.id}`);
}

async function updateQuoteImpl(id: number, fd: FormData) {
  const current = await prisma.quote.findUniqueOrThrow({ where: { id } });
  if (current.status === "FACTURADA") throw new Error("Una cotización facturada no se puede editar.");
  const h = header(fd);
  const { items, ...totals } = computeLines(parseItems(fd, "quote"));
  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
    prisma.quote.update({ where: { id }, data: { ...h, ...totals, items: { create: items } } }),
  ]);
  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${id}`);
}

async function setQuoteStatusImpl(id: number, status: string) {
  if (!(QUOTE_STATUSES as readonly string[]).includes(status) || status === "FACTURADA") throw new Error("Estatus inválido");
  if (status === "ACEPTADA") return acceptQuoteImpl(id);
  await prisma.quote.update({ where: { id }, data: { status } });
  revalidatePath(`/cotizaciones/${id}`);
  revalidatePath("/cotizaciones");
}

/**
 * Propuesta aceptada: si es de un prospecto se da de alta el cliente, y las tarifas de la
 * propuesta pasan a sus tarifas negociadas (se actualizan las que ya existían con la misma clave o nombre).
 */
async function acceptQuoteImpl(id: number) {
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (quote.status === "FACTURADA") throw new Error("La cotización ya está facturada.");
  const services = await prisma.service.findMany({ select: { code: true, wmsConcept: true } });
  const wmsByCode = new Map(services.map((x) => [x.code, x.wmsConcept]));
  // Solo los conceptos con tarifa (precio, al costo o texto como "+ $10.00 / pedido"); "Sin costo" y "A cotizar" no se copian.
  const offered = quote.items.filter((i) => i.atCost || i.unitPrice > 0);

  const result = await prisma.$transaction(async (tx) => {
    let clientId = quote.clientId;
    let created = false;
    if (!clientId) {
      const name = quote.prospectName.trim();
      if (!name) throw new Error("La cotización no tiene nombre de prospecto.");
      const key = name.toLowerCase().replace(/s+/g, " ");
      const existing = (await tx.client.findMany({ select: { id: true, name: true } })).find((c) => c.name.toLowerCase().replace(/s+/g, " ") === key);
      if (existing) clientId = existing.id;
      else {
        const contact = quote.attention && !/por confirmar/i.test(quote.attention) ? quote.attention : "";
        const c = await tx.client.create({
          data: {
            name,
            legalName: quote.prospectLegalName,
            rfc: quote.prospectRfc,
            contactName: contact,
            email: quote.prospectEmail,
            phone: quote.prospectPhone,
            notes: `Alta automática al aceptar la propuesta ${quote.folio}.`,
          },
        });
        clientId = c.id;
        created = true;
      }
    }

    const rates = await tx.clientRate.findMany({ where: { clientId } });
    const findRate = (code: string, name: string) =>
      rates.find((r) => (code && r.code === code) || r.name.trim().toLowerCase() === name.trim().toLowerCase());
    let added = 0,
      updated = 0;
    let order = rates.reduce((a, r) => Math.max(a, r.sortOrder), 0);
    for (const i of offered) {
      const data = {
        code: i.code,
        name: i.description,
        description: i.detail,
        unit: i.unit,
        unitPrice: i.atCost ? 0 : i.unitPrice,
        priceText: i.priceText,
        atCost: i.atCost,
        taxRate: i.taxRate,
        active: true,
      };
      const prev = findRate(i.code, i.description);
      if (prev) {
        await tx.clientRate.update({ where: { id: prev.id }, data: { ...data, wmsConcept: prev.wmsConcept || wmsByCode.get(i.code) || "" } });
        updated++;
      } else {
        await tx.clientRate.create({ data: { ...data, clientId: clientId!, wmsConcept: wmsByCode.get(i.code) ?? "", sortOrder: ++order } });
        added++;
      }
    }
    await tx.quote.update({ where: { id }, data: { status: "ACEPTADA", clientId, acceptedAt: new Date() } });
    return { clientId: clientId!, created, added, updated };
  });

  revalidatePath(`/cotizaciones/${id}`);
  revalidatePath("/cotizaciones");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${result.clientId}`);
  redirect(`/cotizaciones/${id}?aceptada=${result.created ? "nuevo" : "1"}&tarifas=${result.added}-${result.updated}`);
}

async function duplicateQuoteImpl(id: number) {
  const src = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { items: true } });
  const s = await getSettings();
  const now = new Date();
  const q = await prisma.$transaction(async (tx) => {
    const folio = await nextFolio(tx, "quote");
    return tx.quote.create({
      data: {
        folio,
        clientId: src.clientId,
        prospectName: src.prospectName,
        prospectLegalName: src.prospectLegalName,
        prospectRfc: src.prospectRfc,
        prospectEmail: src.prospectEmail,
        prospectPhone: src.prospectPhone,
        issueDate: now,
        validUntil: addDays(now, s.quoteValidityDays),
        notes: src.notes,
        terms: src.terms,
        attention: src.attention,
        profile: src.profile,
        perOrder: src.perOrder,
        perOrderFee: src.perOrderFee,
        baseVolume: src.baseVolume,
        scenarios: src.scenarios,
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

async function deleteQuoteImpl(id: number) {
  const q = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { _count: { select: { invoices: true } } } });
  if (q._count.invoices > 0) throw new Error("No se puede eliminar: la cotización ya tiene facturas.");
  await prisma.quote.delete({ where: { id } });
  revalidatePath("/cotizaciones");
  redirect("/cotizaciones");
}

// Acciones públicas: los errores regresan como { error } para mostrarlos en el formulario.
export const createQuote = safe(createQuoteImpl);
export const updateQuote = safe(updateQuoteImpl);
export const setQuoteStatus = safe(setQuoteStatusImpl);
export const duplicateQuote = safe(duplicateQuoteImpl);
export const deleteQuote = safe(deleteQuoteImpl);
export const acceptQuote = safe(acceptQuoteImpl);
