/**
 * Seed: configuración de la empresa y tarifario estándar (V5). Es idempotente: no sobrescribe lo que ya editaste.
 *   npm run db:seed            → configuración + catálogo
 *   npm run db:seed -- --demo  → además crea clientes, cotización, factura y movimientos de ejemplo
 */
import { PrismaClient } from "@prisma/client";
import { computeLines } from "../src/lib/totals";
import {
  SECTIONS,
  TARIFAS,
  QUOTE_TERMS,
  INVOICE_DISCLAIMER,
  FULL_FBA_SECTION,
  FULL_FBA,
  TARIFF_TABLES,
  TARIFF_INTRO,
  TARIFF_TERMS,
  TARIFF_CLOSING,
} from "./tarifario";

/** Orden final de secciones y servicios (Full/FBA va después de Envíos nacionales). */
const ALL_SECTIONS = [...SECTIONS.slice(0, 5), FULL_FBA_SECTION, ...SECTIONS.slice(5)];
const ALL_TARIFAS = [...TARIFAS, ...FULL_FBA];

const prisma = new PrismaClient();

/** Servicios de ejemplo de la primera versión; se reemplazan por el tarifario real si no se editaron. */
const PLACEHOLDERS: Record<string, string> = {
  "ALM-01": "Almacenaje por tarima",
  "ALM-02": "Almacenaje por m³",
  "REC-01": "Recepción de mercancía",
  "PP-01": "Pick & Pack",
  "PP-02": "Pieza adicional",
  "EMP-01": "Material de empaque",
  "ENV-01": "Guía de envío nacional",
  "DEV-01": "Gestión de devoluciones",
  "ETQ-01": "Etiquetado / kitting",
  "INT-01": "Integración e-commerce",
};
const OLD_TERMS_PREFIX = "1. Precios en MXN, más IVA donde aplique.";

async function seedSettings() {
  const current = await prisma.companySettings.findUnique({ where: { id: 1 } });
  if (!current) {
    await prisma.companySettings.create({
      data: {
        id: 1,
        tradeName: "Kurier Fulfillment",
        city: "Ciudad de México",
        state: "CDMX",
        address: "Castilla 262, Col. Álamos, Benito Juárez",
        email: "contacto@kurierfulfillment.com",
        website: "www.kurierfulfillment.com",
        quoteValidityDays: 30,
        paymentTermsDays: 8,
        quoteTerms: QUOTE_TERMS,
        invoiceDisclaimer: INVOICE_DISCLAIMER,
        invoiceNotes: "",
        tariffIntro: TARIFF_INTRO,
        tariffTerms: TARIFF_TERMS,
        tariffClosing: TARIFF_CLOSING,
      },
    });
    return;
  }
  // Completa solo lo que siga vacío o con los valores de ejemplo (no pisa lo que ya configuraste).
  const patch: Record<string, string | number> = {};
  if (current.primaryColor.toUpperCase() === "#0F2A4A") patch.primaryColor = "#1F4E79";
  if (current.accentColor.toUpperCase() === "#F28C28") patch.accentColor = "#ED7D31";
  if (!current.city) patch.city = "Ciudad de México";
  if (!current.state) patch.state = "CDMX";
  if (!current.address) patch.address = "Castilla 262, Col. Álamos, Benito Juárez";
  if (!current.email) patch.email = "contacto@kurierfulfillment.com";
  if (!current.website) patch.website = "www.kurierfulfillment.com";
  if (!current.quoteTerms || current.quoteTerms.startsWith(OLD_TERMS_PREFIX)) {
    patch.quoteTerms = QUOTE_TERMS;
    patch.quoteValidityDays = 30;
  }
  if (!current.invoiceDisclaimer) patch.invoiceDisclaimer = INVOICE_DISCLAIMER;
  if (!current.tariffIntro) patch.tariffIntro = TARIFF_INTRO;
  if (!current.tariffTerms) patch.tariffTerms = TARIFF_TERMS;
  if (!current.tariffClosing) patch.tariffClosing = TARIFF_CLOSING;
  if (current.invoiceNotes === "Favor de indicar el folio de esta factura como referencia en su pago.") patch.invoiceNotes = "";
  if (current.paymentTermsDays === 30) patch.paymentTermsDays = 8;
  if (Object.keys(patch).length) await prisma.companySettings.update({ where: { id: 1 }, data: patch });
}

async function seedTarifario() {
  for (const [i, sec] of ALL_SECTIONS.entries()) {
    // Solo se ajusta el orden; la nota que hayas editado se respeta.
    await prisma.serviceSection.upsert({ where: { name: sec.name }, update: { sortOrder: i }, create: { ...sec, sortOrder: i } });
  }
  if ((await prisma.tariffTable.count()) === 0) {
    await prisma.tariffTable.createMany({
      data: TARIFF_TABLES.map((t, i) => ({ ...t, note: t.note ?? "", inQuotes: t.inQuotes ?? false, sortOrder: i })),
    });
  }

  // Quita los servicios de ejemplo que no se editaron
  const existing = await prisma.service.findMany({ where: { code: { in: Object.keys(PLACEHOLDERS) } } });
  for (const svc of existing) {
    if (PLACEHOLDERS[svc.code] === svc.name) await prisma.service.delete({ where: { id: svc.id } });
  }

  let created = 0;
  for (const [i, t] of ALL_TARIFAS.entries()) {
    const data = {
      name: t.name,
      section: t.section,
      description: t.description,
      unit: t.unit,
      unitPrice: t.unitPrice,
      priceText: t.priceText ?? "",
      atCost: t.atCost ?? false,
      taxRate: 16,
      sortOrder: i,
    };
    const found = await prisma.service.findUnique({ where: { code: t.code } });
    if (!found) {
      await prisma.service.create({ data: { code: t.code, ...data } });
      created++;
    } else if (!found.section) {
      // Existía con la misma clave pero sin sección (versión anterior): completar sección y orden.
      await prisma.service.update({ where: { id: found.id }, data: { section: t.section, sortOrder: i } });
    }
  }
  return created;
}

async function main() {
  await seedSettings();
  const created = await seedTarifario();
  console.log(`✔ Configuración y tarifario (${created} servicios nuevos, ${ALL_TARIFAS.length} en el tarifario)`);

  if (!process.argv.includes("--demo")) return;

  const existing = await prisma.client.count();
  if (existing > 0) {
    console.log("• Ya hay clientes; se omiten datos demo.");
    return;
  }

  const svc = Object.fromEntries((await prisma.service.findMany()).map((x) => [x.code, x]));
  const line = (code: string, quantity: number, over: Partial<Parameters<typeof computeLines>[0][number]> = {}) => {
    const t = svc[code];
    return { code, description: t.name, detail: t.description, section: t.section, priceText: t.priceText, unit: t.unit, quantity, unitPrice: t.unitPrice, taxRate: 16, atCost: t.atCost, ...over };
  };

  const cestco = await prisma.client.create({ data: { name: "Cestco Dental" } });
  const basic = await prisma.client.create({ data: { name: "Basic & Pure", contactName: "Compras" } });
  const now = new Date();

  // Cotización tipo "Cestco Dental": tarifas por sección + costo mensual estimado (250 pedidos)
  const q = computeLines([
    line("SET-01", 0),
    line("SIS-01", 1),
    { code: "", description: "Pedido de 1 a 2 piezas", detail: "Pick & pack con bolsa de envío estándar incluida.", section: "Fulfillment — AliExpress y sitio web", unit: "Pedido", quantity: 250, unitPrice: 35, taxRate: 16, scales: true },
    { code: "", description: "Pedido de 3 a 4 piezas", detail: "Pick & pack con bolsa de envío estándar incluida.", section: "Fulfillment — AliExpress y sitio web", unit: "Pedido", quantity: 0, unitPrice: 45, taxRate: 16 },
    { code: "", description: "Caja tear strip premium", detail: "En lugar de la bolsa estándar, para pedidos que lo requieran.", section: "Fulfillment — AliExpress y sitio web", priceText: "+ $10.00 / pedido", unit: "Pedido", quantity: 0, unitPrice: 10, taxRate: 16 },
    line("FUL-07", 0, { section: "Fulfillment — AliExpress y sitio web", detail: "Por cada pieza arriba de las 4 incluidas." }),
    line("GUI-01", 250, { section: "Fulfillment — AliExpress y sitio web", scales: true }),
    line("PRE-01", 0),
    line("PRE-02", 0),
    line("PRE-03", 0),
    line("PRE-04", 0),
    line("REC-01", 0),
    line("REC-02", 0),
    line("REC-03", 0),
    line("ALM-01", 0),
    line("ALM-02", 0),
    line("DEV-01", 0),
  ]);
  await prisma.$transaction(async (tx) => {
    const s = await tx.companySettings.update({ where: { id: 1 }, data: { nextQuoteNumber: { increment: 1 }, nextInvoiceNumber: { increment: 1 } } });
    const { items, ...totals } = q;
    await tx.quote.create({
      data: {
        folio: `${s.quotePrefix}-${String(s.nextQuoteNumber - 1).padStart(5, "0")}`,
        clientId: cestco.id,
        validUntil: new Date(now.getTime() + 30 * 86400000),
        status: "ENVIADA",
        attention: "Por confirmar",
        profile: JSON.stringify([
          { label: "Fulfillment por pedido", value: "Pedidos de AliExpress y de su sitio web (Shopify o Tiendanube)." },
          { label: "Preparación de envíos", value: "Reabastecimiento a Mercado Libre Full y Amazon FBA." },
          { label: "Composición del pedido", value: "De 1 a 4 piezas por pedido." },
          { label: "Volumen mensual", value: "Por confirmar." },
        ]),
        notes: "Ejemplo con todos los pedidos de 1 a 2 piezas en bolsa estándar y guía generada por Kurier. No incluye almacenamiento, preparación para Full y FBA, devoluciones ni flete, que se cobran por consumo real.",
        perOrder: JSON.stringify([
          { label: "1 a 2 piezas, bolsa estándar", amount: 35 },
          { label: "1 a 2 piezas, caja tear strip premium", amount: 45 },
          { label: "3 a 4 piezas, bolsa estándar", amount: 45 },
          { label: "3 a 4 piezas, caja tear strip premium", amount: 55 },
        ]),
        perOrderFee: 5,
        baseVolume: 250,
        scenarios: "250, 500, 1000",
        terms: s.quoteTerms,
        ...totals,
        items: { create: items },
      },
    });

    // Factura tipo "Basic & Pure": semanal, con guía al costo
    const inv = computeLines([
      { ...line("FUL-01", 39), description: "Orden Ligera (hasta 2 SKUs o piezas, iguales o mixtos)" },
      { ...line("FUL-07", 9), description: "Pieza adicional (más allá de las 2 incluidas en la Orden Ligera)" },
      { ...line("GUI-01", 39), unitPrice: 10 },
      { ...line("GUI-02", 39), priceText: "Variable (al costo)", amount: 6324.26 },
    ]);
    await tx.invoice.create({
      data: {
        folio: `${s.invoicePrefix}-${String(s.nextInvoiceNumber - 1).padStart(5, "0")}`,
        clientId: basic.id,
        dueDate: new Date(now.getTime() + 8 * 86400000),
        period: "15 al 22 de agosto de 2026 — ciclo semanal",
        volume: "39 pedidos, todos bajo la tarifa Orden Ligera negociada.",
        storage: "No se cobra en este periodo.",
        terms: s.paymentTerms,
        notes: "Total de pedidos facturados en el periodo: 39, con 9 piezas adicionales y 39 guías generadas. El monto de guías de envío corresponde al costo real de paquetería del periodo, facturado sin margen.",
        ...inv.subtotal ? { subtotal: inv.subtotal, discount: inv.discount, tax: inv.tax, total: inv.total } : {},
        items: { create: inv.items },
      },
    });
  });

  await prisma.transaction.createMany({
    data: [
      { type: "EGRESO", category: "Renta de almacén", description: "Renta de bodega", amount: 58000, tax: 8000, date: now },
      { type: "EGRESO", category: "Paquetería y fletes", description: "Guías de la semana", amount: 7336.14, tax: 1011.88, date: now },
    ],
  });
  console.log("✔ Datos demo creados");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
