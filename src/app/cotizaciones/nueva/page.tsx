import { createQuote } from "@/app/actions/quotes";
import { DocumentEditor } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/kit";
import { DEFAULT_PROFILE, editorData } from "@/lib/editor-data";
import { addDays, toInputDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  const { clients, services, clientRates, settings, brands } = await editorData();
  const today = new Date();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Nueva cotización"
        subtitle="Propuesta comercial para un prospecto (o renegociación con un cliente actual). Al aceptarse se da de alta el cliente con sus tarifas."
        back={{ href: "/cotizaciones", label: "Cotizaciones" }}
      />
      {(
        <DocumentEditor
          kind="quote"
          action={createQuote}
          clients={clients}
          services={services}
          clientRates={clientRates}
          brands={brands}
          defaultTaxRate={settings.defaultTaxRate}
          submitLabel="Crear cotización"
          defaults={{
            clientId: clientId ? Number(clientId) : undefined,
            issueDate: toInputDate(today),
            secondDate: toInputDate(addDays(today, settings.quoteValidityDays)),
            notes: "",
            terms: settings.quoteTerms,
            attention: "Por confirmar",
            profile: DEFAULT_PROFILE,
            perOrder: [],
            perOrderFee: 5,
            baseVolume: 0,
            scenarios: "",
            items: [],
          }}
        />
      )}
    </div>
  );
}
