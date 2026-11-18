import Link from "next/link";
import { createInvoice } from "@/app/actions/invoices";
import { DocumentEditor } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/ui";
import { editorData, itemsForEditor } from "@/lib/editor-data";
import { addDays, toInputDate } from "@/lib/money";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ clientId?: string; quoteId?: string }> }) {
  const { clientId, quoteId } = await searchParams;
  const { clients, services, settings } = await editorData();
  const quote = quoteId
    ? await prisma.quote.findUnique({ where: { id: Number(quoteId) }, include: { items: { orderBy: { position: "asc" } } } })
    : null;
  const today = new Date();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Nueva factura"
        subtitle={
          quote
            ? `Con las tarifas de la cotización ${quote.folio}. Captura las cantidades del periodo; los conceptos con cantidad 0 no se facturan.`
            : "Documento informativo, sin timbrado fiscal"
        }
        back={quote ? { href: `/cotizaciones/${quote.id}`, label: quote.folio } : { href: "/facturas", label: "Facturas" }}
      />
      {clients.length === 0 ? (
        <div className="card p-6 text-sm">
          Primero da de alta un cliente.{" "}
          <Link href="/clientes/nuevo" className="text-brand underline">
            Crear cliente
          </Link>
        </div>
      ) : (
        <DocumentEditor
          kind="invoice"
          action={createInvoice}
          clients={clients}
          services={services}
          defaultTaxRate={settings.defaultTaxRate}
          submitLabel="Crear factura"
          defaults={{
            clientId: quote?.clientId ?? (clientId ? Number(clientId) : undefined),
            quoteId: quote?.id,
            issueDate: toInputDate(today),
            secondDate: toInputDate(addDays(today, settings.paymentTermsDays)),
            notes: settings.invoiceNotes,
            terms: settings.paymentTerms,
            items: quote ? itemsForEditor(quote.items) : [],
          }}
        />
      )}
    </div>
  );
}
