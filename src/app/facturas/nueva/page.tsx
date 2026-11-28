import Link from "next/link";
import { redirect } from "next/navigation";
import { createInvoice } from "@/app/actions/invoices";
import { DocumentEditor, type DocumentDefaults } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/kit";
import { editorData, invoiceFolioSuggestions, itemsForEditor } from "@/lib/editor-data";
import { addDays, formatMoney, toInputDate } from "@/lib/money";
import { prisma } from "@/lib/db";
import { previewImport } from "@/lib/wms/imports";
import { DATE_RE } from "@/lib/orders";
import { weeklyDraft } from "@/lib/weekly-billing";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";
import { suggestedCnyRate } from "@/lib/fx";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Nueva factura") };
}

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ clientId?: string; quoteId?: string; importId?: string; ordenes?: string; semana?: string }> }) {
  const t = await getT();
  const { clientId, quoteId, importId, ordenes, semana } = await searchParams;
  const [{ clients, services, clientRates, settings, brands }, folioByClient, fx] = await Promise.all([editorData(), invoiceFolioSuggestions(), suggestedCnyRate()]);
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
    // Factura semanal de servicio logístico desde Órdenes diarias (mismo cálculo que Facturación semanal).
    const d = await weeklyDraft(Number(ordenes), semana, settings);
    if (d) {
      defaults = { ...base, clientId: d.client.id, ordersWeek: d.ordersWeek, period: d.period, volume: d.volume, storage: d.storage, items: d.items };
      subtitle = d.rate.rate
        ? t("Desde Órdenes diarias: {v0} paquetes × {v1} ({v2}){v3}. Revisa y ajusta antes de crearla.", {
            v0: d.packages,
            v1: formatMoney(d.rate.rate),
            v2: t(d.rate.label).toLowerCase(),
            v3: d.supplyLines.length ? t(", más {v0} material(es) de empaque ({v1})", { v0: d.supplyLines.length, v1: formatMoney(d.supplySale) }) : "",
          }) +
          (d.unpriced ? ` ${t("{v0} insumo(s) sin precio de venta: captura el precio o quítalos si van incluidos en el servicio.", { v0: d.unpriced })}` : "") +
          (d.supplyLines.length
            ? ""
            : d.onlyNoSupply
              ? ` ${t("Esta semana sus paquetes se registraron como «Sin insumo»: no hay material de empaque que cobrar.")}`
              : ` ${t("No hay insumos capturados para este cliente en la semana (Órdenes → Insumos de empaque).")}`)
        : t("Desde Órdenes diarias: {v0} paquetes. El cliente no tiene tarifa por paquete; captura el precio antes de crearla.", { v0: d.packages });
      back = { href: `/facturas/semanal?semana=${d.ordersWeek}`, label: t("Facturación semanal") };
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
          fx={fx}
        />
      )}
    </div>
  );
}
