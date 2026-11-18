import Link from "next/link";
import { createInvoice } from "@/app/actions/invoices";
import { DocumentEditor } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/ui";
import { editorData } from "@/lib/editor-data";
import { addDays, toInputDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  const { clients, services, settings } = await editorData();
  const today = new Date();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Nueva factura" subtitle="Documento informativo, sin timbrado fiscal" back={{ href: "/facturas", label: "Facturas" }} />
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
            clientId: clientId ? Number(clientId) : undefined,
            issueDate: toInputDate(today),
            secondDate: toInputDate(addDays(today, settings.paymentTermsDays)),
            notes: settings.invoiceNotes,
            items: [],
          }}
        />
      )}
    </div>
  );
}
