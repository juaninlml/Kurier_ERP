import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateQuote } from "@/app/actions/quotes";
import { DocumentEditor } from "@/components/DocumentEditor";
import { PageHeader } from "@/components/ui";
import { editorData, itemsForEditor, parseProfileJson } from "@/lib/editor-data";
import { toInputDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const quote = await prisma.quote.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!quote) notFound();
  if (quote.status === "FACTURADA") redirect(`/cotizaciones/${id}`);
  const { clients, services, settings } = await editorData();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Editar ${quote.folio}`} back={{ href: `/cotizaciones/${id}`, label: quote.folio }} />
      <DocumentEditor
        kind="quote"
        action={updateQuote.bind(null, id)}
        clients={clients}
        services={services}
        defaultTaxRate={settings.defaultTaxRate}
        submitLabel="Guardar cambios"
        defaults={{
          clientId: quote.clientId,
          issueDate: toInputDate(quote.issueDate),
          secondDate: toInputDate(quote.validUntil),
          notes: quote.notes,
          terms: quote.terms,
          attention: quote.attention,
          profile: parseProfileJson(quote.profile),
          items: itemsForEditor(quote.items),
        }}
      />
    </div>
  );
}
