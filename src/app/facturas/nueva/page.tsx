import Link from "next/link";
import { redirect } from "next/navigation";
import { createInvoice } from "@/app/actions/invoices";
import { DocumentEditor, type DocumentDefaults } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/kit";
import { editorData, itemsForEditor } from "@/lib/editor-data";
import { addDays, formatMoney, toInputDate } from "@/lib/money";
import { prisma } from "@/lib/db";
import { previewImport } from "@/lib/wms/imports";
import { clientOrdersSummary, DATE_RE, rangeLabel, weekOf } from "@/lib/orders";
import { suppliesByMaterial } from "@/lib/supplies";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nueva factura" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ clientId?: string; quoteId?: string; importId?: string; ordenes?: string; semana?: string }> }) {
  const { clientId, quoteId, importId, ordenes, semana } = await searchParams;
  const { clients, services, clientRates, settings, brands } = await editorData();
  const today = new Date();
  const base: DocumentDefaults = {
    clientId: clientId ? Number(clientId) : undefined,
    issueDate: toInputDate(today),
    secondDate: toInputDate(addDays(today, settings.paymentTermsDays)),
    notes: settings.invoiceNotes,
    terms: settings.paymentTerms,
    items: [],
  };
  let defaults = base;
  let subtitle: string = "Documento informativo, sin timbrado fiscal";
  let back = { href: "/facturas", label: "Facturas" };

  if (ordenes && semana && DATE_RE.test(semana)) {
    // Factura semanal de servicio logístico desde Órdenes diarias.
    const week = weekOf(semana);
    const [sum, sup] = await Promise.all([clientOrdersSummary(Number(ordenes), week.from, week.to), suppliesByMaterial(week.from, week.to, Number(ordenes))]);
    if (sum) {
      const supplyLines = sup.list
        .filter((m) => !m.noSupply && m.unitPrice > 0)
        .map((m) => ({
          description: `Material de empaque: ${m.name}`,
          detail: m.size ? `Medidas ${m.size.replace(/\*/g, "×")} cm` : "",
          section: "Material de empaque",
          unit: "Pieza",
          quantity: m.qty,
          unitPrice: m.unitPrice,
          taxRate: settings.defaultTaxRate,
        }));
      const period = rangeLabel(week.from, week.to);
      const breakdown = sum.byWave.filter((w) => w.total > 0).map((w) => `${w.name}: ${w.total}`).join(" · ");
      defaults = {
        ...base,
        clientId: sum.client.id,
        ordersWeek: week.from,
        period: `${period} — ciclo semanal`,
        volume: `${sum.total} paquetes en ${sum.days.length} día(s) operado(s)`,
        storage: "No se cobra en este periodo.",
        items: [
          {
            description: "Servicio logístico",
            detail: `Paquetes procesados del ${period}${breakdown ? ` (${breakdown})` : ""}`,
            unit: "Paquete",
            quantity: sum.total,
            unitPrice: sum.rate.rate,
            taxRate: settings.defaultTaxRate,
          },
          ...supplyLines,
        ],
      };
      subtitle = sum.rate.rate
        ? `Desde Órdenes diarias: ${sum.total} paquetes × ${formatMoney(sum.rate.rate)} (${sum.rate.label.toLowerCase()})${supplyLines.length ? `, más ${supplyLines.length} material(es) de empaque (${formatMoney(sup.sale)})` : ""}. Revisa y ajusta antes de crearla.`
        : `Desde Órdenes diarias: ${sum.total} paquetes. El cliente no tiene tarifa por paquete; captura el precio antes de crearla.`;
      back = { href: `/ordenes?fecha=${week.from}`, label: "Órdenes diarias" };
    }
  } else if (importId) {
    const imp = await prisma.wmsImport.findUnique({ where: { id: Number(importId) } });
    if (!imp) redirect("/facturas/importar");
    if (imp.status === "FACTURADO" || !imp.clientId) redirect(`/facturas/importar/${imp.id}`);
    const { billing, period, statement } = await previewImport(imp);
    defaults = {
      ...base,
      clientId: imp.clientId,
      importId: imp.id,
      period,
      volume: billing.volumeText,
      storage: billing.groups.some((g) => /almacen/i.test(g.section)) ? "" : "No se cobra en este periodo.",
      notes: [
        `Estado de cobro del WMS ${imp.folio}${billing.volumeText ? `: ${billing.volumeText}` : ""}.`,
        billing.groups.some((g) => g.line.atCost) ? "Las guías de envío se facturan al costo real de paquetería del periodo, sin margen." : "",
      ]
        .filter(Boolean)
        .join(" "),
      items: billing.groups.map((g) => g.line),
    };
    subtitle = `Desde el estado de cobro ${imp.folio} del WMS (total WMS ${formatMoney(statement.total)}). Revisa y ajusta antes de crearla.`;
    back = { href: `/facturas/importar/${imp.id}`, label: imp.folio };
  } else if (quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: Number(quoteId) }, include: { items: { orderBy: { position: "asc" } } } });
    if (quote) {
      defaults = { ...base, clientId: quote.clientId ?? undefined, brandId: quote.brandId ?? undefined, quoteId: quote.id, items: itemsForEditor(quote.items) };
      subtitle = `Con las tarifas de la cotización ${quote.folio}. Captura las cantidades del periodo; los conceptos con cantidad 0 no se facturan.`;
      back = { href: `/cotizaciones/${quote.id}`, label: quote.folio };
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Nueva factura" subtitle={subtitle} back={back} />
      {clients.length === 0 ? (
        <div className="card p-6 text-sm">
          Primero da de alta un cliente.{" "}
          <Link href="/clientes/nuevo" className="text-primary underline">
            Crear cliente
          </Link>
        </div>
      ) : (
        <DocumentEditor
          kind="invoice"
          action={createInvoice}
          clients={clients}
          services={services}
          clientRates={clientRates}
          brands={brands}
          defaultTaxRate={settings.defaultTaxRate}
          submitLabel="Crear factura"
          defaults={defaults}
        />
      )}
    </div>
  );
}
