import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteQuote, duplicateQuote, setQuoteStatus } from "@/app/actions/quotes";
import { parseProfileJson } from "@/lib/editor-data";
import { PageHeader, StatusBadge } from "@/components/ui";
import { DocumentView } from "@/components/DocumentView";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { client: true, items: { orderBy: { position: "asc" } }, invoices: { select: { id: true, folio: true } } },
  });
  if (!quote) notFound();
  const editable = quote.status !== "FACTURADA";
  const profile = parseProfileJson(quote.profile);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Cotización ${quote.folio}`}
        back={{ href: "/cotizaciones", label: "Cotizaciones" }}
        subtitle={
          <span className="flex items-center gap-2">
            <StatusBadge status={quote.status} />
            <Link href={`/clientes/${quote.clientId}`} className="hover:text-brand">
              {quote.client.name}
            </Link>
            · Emitida {formatDate(quote.issueDate)} · Vigente hasta {formatDate(quote.validUntil)}
          </span>
        }
        actions={
          <>
            <a href={`/api/pdf/cotizacion/${quote.id}`} target="_blank" className="btn-secondary">
              Ver PDF
            </a>
            <a href={`/api/pdf/cotizacion/${quote.id}?download`} className="btn-secondary">
              Descargar
            </a>
            {editable && (
              <Link href={`/cotizaciones/${quote.id}/editar`} className="btn-secondary">
                Editar
              </Link>
            )}
            <Link href={`/facturas/nueva?quoteId=${quote.id}`} className="btn-accent">
              Facturar con estas tarifas
            </Link>
          </>
        }
      />

      {quote.invoices.length > 0 && (
        <div className="mb-4 rounded-md bg-violet-50 px-4 py-3 text-sm text-violet-800">
          Facturada en:{" "}
          {quote.invoices.map((i, n) => (
            <span key={i.id}>
              {n > 0 && ", "}
              <Link href={`/facturas/${i.id}`} className="font-medium underline">
                {i.folio}
              </Link>
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-6">
          {(quote.attention || profile.length > 0) && (
            <div className="card overflow-hidden">
              <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">Perfil de la operación cotizada</h2>
              <dl className="divide-y divide-slate-100 text-sm">
                {[{ label: "Atención", value: quote.attention }, ...profile].filter((r) => r.value).map((r) => (
                  <div key={r.label} className="grid grid-cols-[200px_1fr] gap-3 px-4 py-2">
                    <dt className="font-medium text-brand">{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <DocumentView kind="quote" items={quote.items} subtotal={quote.subtotal} discount={quote.discount} tax={quote.tax} total={quote.total} />
          {(quote.notes || quote.terms) && (
            <div className="card grid gap-4 p-5 text-sm md:grid-cols-2">
              {quote.notes && (
                <div>
                  <div className="label">Notas</div>
                  <p className="whitespace-pre-line">{quote.notes}</p>
                </div>
              )}
              {quote.terms && (
                <div>
                  <div className="label">Condiciones comerciales</div>
                  <p className="whitespace-pre-line">{quote.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {editable && (
            <div className="card p-4">
              <div className="label mb-2">Cambiar estatus</div>
              <div className="grid gap-2">
                {(["BORRADOR", "ENVIADA", "ACEPTADA", "RECHAZADA"] as const).map((st) => (
                  <form key={st} action={setQuoteStatus.bind(null, quote.id, st)}>
                    <button className={`btn-secondary w-full justify-start ${quote.status === st ? "ring-2 ring-brand/30" : ""}`} disabled={quote.status === st}>
                      <StatusBadge status={st} />
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}
          <div className="card space-y-2 p-4">
            <form action={duplicateQuote.bind(null, quote.id)}>
              <SubmitButton className="btn-secondary w-full" pendingText="Duplicando…">
                Duplicar cotización
              </SubmitButton>
            </form>
            {quote.invoices.length === 0 && (
              <form action={deleteQuote.bind(null, quote.id)}>
                <ConfirmButton message={`¿Eliminar la cotización ${quote.folio}?`} className="btn-danger w-full">
                  Eliminar
                </ConfirmButton>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
