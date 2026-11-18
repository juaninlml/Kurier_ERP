/**
 * Seed inicial: configuración de empresa y catálogo base de servicios de fulfillment.
 *   npm run db:seed            → configuración + catálogo
 *   npm run db:seed -- --demo  → además crea clientes, cotización, factura y movimientos de ejemplo
 */
import { PrismaClient } from "@prisma/client";
import { computeLines } from "../src/lib/totals";

const prisma = new PrismaClient();

const SERVICES = [
  { code: "ALM-01", name: "Almacenaje por tarima", description: "Posición de tarima en rack, mensual", unit: "Tarima", unitPrice: 450 },
  { code: "ALM-02", name: "Almacenaje por m³", description: "Espacio en anaquel, mensual", unit: "m³", unitPrice: 180 },
  { code: "REC-01", name: "Recepción de mercancía", description: "Descarga, conteo e ingreso a inventario", unit: "Caja", unitPrice: 12 },
  { code: "PP-01", name: "Pick & Pack", description: "Surtido y empaque por pedido (hasta 3 piezas)", unit: "Pedido", unitPrice: 22 },
  { code: "PP-02", name: "Pieza adicional", description: "Pieza adicional por pedido", unit: "Pieza", unitPrice: 3.5 },
  { code: "EMP-01", name: "Material de empaque", description: "Caja, relleno y cinta estándar", unit: "Pedido", unitPrice: 9 },
  { code: "ENV-01", name: "Guía de envío nacional", description: "Paquetería estándar hasta 1 kg", unit: "Envío", unitPrice: 115 },
  { code: "DEV-01", name: "Gestión de devoluciones", description: "Recepción, inspección y reingreso", unit: "Pieza", unitPrice: 18 },
  { code: "ETQ-01", name: "Etiquetado / kitting", description: "Etiquetado, armado de kits o promociones", unit: "Pieza", unitPrice: 2.5 },
  { code: "INT-01", name: "Integración e-commerce", description: "Conexión con tienda en línea (pago único)", unit: "Servicio", unitPrice: 3500 },
];

async function main() {
  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      tradeName: "Kurier Fulfillment",
      quoteTerms:
        "1. Precios en MXN, más IVA donde aplique.\n2. Vigencia según fecha indicada en esta cotización.\n3. Tarifas de paquetería sujetas a cambio sin previo aviso por parte del carrier.\n4. El almacenaje se factura por mes calendario completo.",
      invoiceNotes: "Favor de indicar el folio de esta factura como referencia en su pago.",
    },
  });

  for (const s of SERVICES) {
    await prisma.service.upsert({ where: { code: s.code }, update: {}, create: { ...s, taxRate: 16 } });
  }
  console.log(`✔ Configuración y ${SERVICES.length} servicios`);

  if (!process.argv.includes("--demo")) return;

  const existing = await prisma.client.count();
  if (existing > 0) {
    console.log("• Ya hay clientes; se omiten datos demo.");
    return;
  }

  const c1 = await prisma.client.create({
    data: { name: "Tienda Demo", legalName: "Tienda Demo S.A. de C.V.", rfc: "TDE010101AAA", contactName: "María López", email: "compras@tiendademo.mx", phone: "55 1234 5678", address: "Av. Siempre Viva 123, CDMX" },
  });
  await prisma.client.create({ data: { name: "Moda Online", contactName: "Carlos Ruiz", email: "carlos@modaonline.mx" } });

  const now = new Date();
  const lines = computeLines([
    { code: "ALM-01", description: "Almacenaje por tarima — Posición de tarima en rack, mensual", unit: "Tarima", quantity: 12, unitPrice: 450, taxRate: 16 },
    { code: "PP-01", description: "Pick & Pack — Surtido y empaque por pedido", unit: "Pedido", quantity: 800, unitPrice: 22, taxRate: 16, discountPct: 10 },
    { code: "ENV-01", description: "Guía de envío nacional", unit: "Envío", quantity: 800, unitPrice: 115, taxRate: 16 },
  ]);

  await prisma.$transaction(async (tx) => {
    const s = await tx.companySettings.update({ where: { id: 1 }, data: { nextQuoteNumber: { increment: 1 }, nextInvoiceNumber: { increment: 1 } } });
    const { items, ...totals } = lines;
    const q = await tx.quote.create({
      data: {
        folio: `${s.quotePrefix}-${String(s.nextQuoteNumber - 1).padStart(5, "0")}`,
        clientId: c1.id,
        validUntil: new Date(now.getTime() + 15 * 86400000),
        status: "FACTURADA",
        terms: s.quoteTerms,
        ...totals,
        items: { create: items },
      },
    });
    await tx.invoice.create({
      data: {
        folio: `${s.invoicePrefix}-${String(s.nextInvoiceNumber - 1).padStart(5, "0")}`,
        clientId: c1.id,
        quoteId: q.id,
        dueDate: new Date(now.getTime() + 30 * 86400000),
        notes: s.invoiceNotes,
        ...totals,
        items: { create: items },
      },
    });
  });

  await prisma.transaction.createMany({
    data: [
      { type: "EGRESO", category: "Renta de almacén", description: "Renta de bodega", amount: 58000, tax: 8000, date: now },
      { type: "EGRESO", category: "Nómina", description: "Nómina quincenal", amount: 72000, tax: 0, date: now },
      { type: "EGRESO", category: "Material de empaque", description: "Cajas y relleno", amount: 6380, tax: 880, date: now },
      { type: "INGRESO", category: "Otros ingresos", description: "Venta de tarimas usadas", amount: 2320, tax: 320, date: now },
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
