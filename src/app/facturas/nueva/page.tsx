import Link from "next/link";
import { redirect } from "next/navigation";
import { createInvoice } from "@/app/actions/invoices";
import { DocumentEditor, type DocumentDefaults } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/kit";
import { editorData, invoiceFolioSuggestions, itemsForEditor } from "@/lib/editor-data";
import { addDays, formatMoney, toInputDate } from "@/lib/money";
import { prisma } from "@/lib/db";
import { previewImport } from "@/lib/wms/imports";
import { clientOrdersSummary, DATE_RE, rangeLabel, weekOf } from "@/lib/orders";
import { suppliesByMaterial } from "@/lib/supplies";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Nueva factura") };
}

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ clientId?: string; quoteId?: string; importId?: string; ordenes?: string; semana?: string }> }) {
  const t = await getT();
  const { clientId, quoteId, importId, ordenes, semana } = await searchParams;
  const [{ clients, services, clientRates, settings, brands }, folioByClient] = await Promise.all([editorData(), invoiceFolioSuggestions()]);
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
  let subtitle: string = t("Documento informativo, sin timbrado fiscal");
  let back = { href: "/facturas", label: t("Facturas") };

  if (ordenes && semana && DATE_RE.test(semana)) {
    // Factura semanal de servicio logístico desde Órdenes diarias.
    const week = weekOf(semana);
    const [sum, sup] = await Promise.all([clientOrdersSummary(Number(ordenes), week.from, week.to), suppliesByMaterial(week.from, week.to, Number(ordenes))]);
    if (sum) {
      // Todos los insumos consumidos en la semana (menos «Sin insumo»). Precio: el de la tarifa del cliente
      // con el mismo nombre del material, si la tiene; si no, el precio de venta del material.
      const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^material de empaque:\s*/i, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
      const clientPrice = (name: string) => sum.client.rates.find((r) => r.active && !r.atCost && norm(r.name) === norm(name))?.unitPrice;
      const supplyLines = sup.list
        .filter((m) => !m.noSupply)
        .map((m) => {
          const price = clientPrice(m.name) ?? m.unitPrice;
          return {
            description: `Material de empaque: ${m.name}`, // se guarda en la factura: siempre en español
            detail: m.size ? `Medidas ${m.size.replace(/\*/g, "×")} cm` : "",
            section: "Material de empaque",
            unit: "Pieza",
            quantity: m.qty,
            unitPrice: price,
            taxRate: settings.defaultTaxRate,
          };
        });
      const unpriced = supplyLines.filter((l) => !l.unitPrice).length;
      const supplySale = supplyLines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
      const period = rangeLabel(week.from, week.to, "es-MX"); // se guarda en la factura: siempre en español
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
        ? t("Desde Órdenes diarias: {v0} paquetes × {v1} ({v2}){v3}. Revisa y ajusta antes de crearla.", {
            v0: sum.total,
            v1: formatMoney(sum.rate.rate),
            v2: t(sum.rate.label).toLowerCase(),
            v3: supplyLines.length ? t(", más {v0} material(es) de empaque ({v1})", { v0: supplyLines.length, v1: formatMoney(supplySale) }) : "",
          }) +
          (unpriced ? ` ${t("{v0} insumo(s) sin precio de venta: captura el precio o quítalos si van incluidos en el servicio.", { v0: unpriced })}` : "") +
          (supplyLines.length
            ? ""
            : sup.list.some((m) => m.noSupply)
              ? ` ${t("Esta semana sus paquetes se registraron como «Sin insumo»: no hay material de empaque que cobrar.")}`
              : ` ${t("No hay insumos capturados para este cliente en la semana (Órdenes → Insumos de empaque).")}`)
        : t("Desde Órdenes diarias: {v0} paquetes. El cliente no tiene tarifa por paquete; captura el precio antes de crearla.", { v0: sum.total });
      back = { href: `/ordenes?fecha=${week.from}`, label: t("Órdenes diarias") };
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
        `Estado de cobro del WMS ${imp.folio}${billing.volumeText ? `: ${billing.volumeText}` : ""}.`, // nota guardada en la factura
        billing.groups.some((g) => g.line.atCost) ? "Las guías de envío se facturan al costo real de paquetería del periodo, sin margen." : "",
      ]
        .filter(Boolean)
        .join(" "),
      items: billing.groups.map((g) => g.line),
    };
    subtitle = t("Desde el estado de cobro {v0} del WMS (total WMS {v1}). Revisa y ajusta antes de crearla.", { v0: imp.folio, v1: formatMoney(statement.total) });
    back = { href: `/facturas/importar/${imp.id}`, label: imp.folio };
  } else if (quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: Number(quoteId) }, include: { items: { orderBy: { position: "asc" } } } });
    if (quote) {
      defaults = { ...base, clientId: quote.clientId ?? undefined, brandId: quote.brandId ?? undefined, quoteId: quote.id, items: itemsForEditor(quote.items) };
      subtitle = t("Con las tarifas de la cotización {v0}. Captura las cantidades del periodo; los conceptos con cantidad 0 no se facturan.", { v0: quote.folio });
      back = { href: `/cotizaciones/${quote.id}`, label: quote.folio };
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Nueva factura" subtitle={subtitle} back={back} />
      {clients.length === 0 ? (
        <div className="card p-6 text-sm">
          <Tr>Primero da de alta un cliente.</Tr>{" "}
          <Link href="/clientes/nuevo" className="text-primary underline">
            <Tr>Crear cliente</Tr>
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
          submitLabel={t("Crear factura")}
          defaults={defaults}
          folioByClient={folioByClient}
        />
      )}
    </div>
  );
}
