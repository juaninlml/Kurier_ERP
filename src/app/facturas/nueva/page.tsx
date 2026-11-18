import Link from "next/link";
import { redirect } from "next/navigation";
import { createInvoice } from "@/app/actions/invoices";
import { DocumentEditor, type DocumentDefaults } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/kit";
import { editorData, itemsForEditor } from "@/lib/editor-data";
import { addDays, formatMoney, toInputDate } from "@/lib/money";
import { prisma } from "@/lib/db";
import { previewImport } from "@/lib/wms/imports";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nueva factura" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ clientId?: string; quoteId?: string; importId?: string }> }) {
  const { clientId, quoteId, importId } = await searchParams;
  const { clients, services, clientRates, settings } = await editorData();
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

  if (importId) {
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
      defaults = { ...base, clientId: quote.clientId, quoteId: quote.id, items: itemsForEditor(quote.items) };
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
          defaultTaxRate={settings.defaultTaxRate}
          submitLabel="Crear factura"
          defaults={defaults}
        />
      )}
    </div>
  );
}
