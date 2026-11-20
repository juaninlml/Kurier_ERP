import { BadgeCheck, Check, Copy, Download, Eye, Pencil, ReceiptText, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { acceptQuote, deleteQuote, duplicateQuote, setQuoteStatus } from "@/app/actions/quotes";
import { quoteParty } from "@/lib/quote-party";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseProfileJson } from "@/lib/editor-data";
import { PageHeader, StatusBadge } from "@/components/kit";
import { DriveButton } from "@/components/DriveButton";
import { DocumentView } from "@/components/DocumentView";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate, formatMoney } from "@/lib/money";
import { parsePerOrder, parseVolumes, scenarioTable } from "@/lib/quote-extras";
import { Form } from "@/components/Form";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aceptada?: string; tarifas?: string }>;
}) {
  const t = await getT();
  const id = Number((await params).id);
  const { aceptada, tarifas } = await searchParams;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { client: true, items: { orderBy: { position: "asc" } }, invoices: { select: { id: true, folio: true } } },
  });
  if (!quote) notFound();
  const editable = quote.status !== "FACTURADA";
  const profile = parseProfileJson(quote.profile);
  const perOrder = parsePerOrder(quote.perOrder);
  const volumes = parseVolumes(quote.scenarios);
  const scenarios = scenarioTable(quote.items, quote.baseVolume, volumes, formatMoney);
  const party = quoteParty(quote);
  const accepted = quote.status === "ACEPTADA" || quote.status === "FACTURADA";
  const rateCount = quote.items.filter((i) => i.atCost || i.unitPrice > 0).length;
  const [added, updated] = (tarifas ?? "0-0").split("-").map(Number);
  const acceptMessage = party.isProspect
    ? `¿Marcar la propuesta como aceptada? Se dará de alta “${party.name}” como cliente y se cargarán ${rateCount} tarifa(s) en sus tarifas negociadas.`
    : `¿Marcar la propuesta como aceptada? Se actualizarán ${rateCount} tarifa(s) en las tarifas negociadas de ${party.name}.`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("Cotización {v0}", { v0: quote.folio })}
        back={{ href: "/cotizaciones", label: t("Cotizaciones") }}
        subtitle={
          <span className="flex items-center gap-2">
            <StatusBadge status={quote.status} />
            {quote.client ? (
              <Link href={`/clientes/${quote.clientId}`} className="font-medium text-foreground hover:text-primary">
                {party.name}
              </Link>
            ) : (
              <span>
                <span className="font-medium text-foreground">{party.name}</span> <Tr>· prospecto</Tr>
              </span>
            )}
            <Tr>· Emitida</Tr> {formatDate(quote.issueDate)} <Tr>· Vigente hasta</Tr> {formatDate(quote.validUntil)}
          </span>
        }
        actions={
          <>
            <a href={`/api/pdf/cotizacion/${quote.id}`} target="_blank" className="btn-secondary">
              <Eye className="size-4" /> <Tr>Ver PDF</Tr>
            </a>
            <a href={`/api/pdf/cotizacion/${quote.id}?download`} className="btn-secondary">
              <Download className="size-4" /> <Tr>Descargar</Tr>
            </a>
            <DriveButton refKey={`cotizacion:${quote.id}`} path={`/cotizaciones/${quote.id}`} />
            {editable && (
              <Link href={`/cotizaciones/${quote.id}/editar`} className="btn-secondary">
                <Pencil className="size-4" /> <Tr>Editar</Tr>
              </Link>
            )}
            {!accepted && (
              <Form action={acceptQuote.bind(null, quote.id)}>
                <ConfirmButton message={acceptMessage} className="btn-kurier">
                  {party.isProspect ? <UserPlus className="size-4" /> : <BadgeCheck className="size-4" />}
                  {party.isProspect ? t("Aceptada: dar de alta cliente") : t("Aceptada: actualizar tarifas")}
                </ConfirmButton>
              </Form>
            )}
            {accepted && quote.clientId && (
              <Link href={`/facturas/nueva?clientId=${quote.clientId}`} className="btn-kurier">
                <ReceiptText className="size-4" /> <Tr>Nueva factura del cliente</Tr>
              </Link>
            )}
          </>
        }
      />

      {aceptada && quote.client && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-900">
          <BadgeCheck />
          <AlertTitle>{aceptada === "nuevo" ? t("{v0} ya es cliente", { v0: quote.client.name }) : t("Propuesta aceptada")}</AlertTitle>
          <AlertDescription className="text-emerald-900/80">
            {aceptada === "nuevo" ? t("Se dio de alta el cliente con los datos del prospecto. ") : ""}
            <Tr>Tarifas negociadas:</Tr> {added} <Tr>nueva(s)</Tr>{updated ? t(", {v0} actualizada(s)", { v0: updated }) : ""}.{" "}
            <Link href={`/clientes/${quote.client.id}`} className="font-medium underline">
              <Tr>Revisar tarifas y conceptos del WMS</Tr>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {quote.invoices.length > 0 && (
        <div className="mb-4 rounded-md bg-violet-50 px-4 py-3 text-sm text-violet-800">
          <Tr>Facturada en:</Tr>{" "}
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
              <h2 className="border-b border-border px-4 py-3 font-semibold"><Tr>Perfil de la operación cotizada</Tr></h2>
              <dl className="divide-y divide-border text-sm">
                {[{ label: t("Atención"), value: quote.attention }, ...profile].filter((r) => r.value).map((r) => (
                  <div key={r.label} className="grid grid-cols-[200px_1fr] gap-3 px-4 py-2">
                    <dt className="font-medium text-primary">{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <DocumentView kind="quote" items={quote.items} subtotal={quote.subtotal} discount={quote.discount} tax={quote.tax} total={quote.total} />
          {(perOrder.length > 0 || scenarios) && (
            <div className="grid gap-6 xl:grid-cols-2">
              {perOrder.length > 0 && (
                <div className="card overflow-hidden">
                  <h2 className="border-b border-border px-4 py-3 font-semibold"><Tr>Costo por pedido</Tr></h2>
                  <table className="table">
                    <thead>
                      <tr>
                        <th><Tr>Tipo de pedido</Tr></th>
                        <th className="text-right"><Tr>Fulfillment</Tr></th>
                        {quote.perOrderFee > 0 && <th className="text-right"><Tr>Con guía de Kurier</Tr></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {perOrder.map((r) => (
                        <tr key={r.label}>
                          <td className="font-medium text-primary">{r.label}</td>
                          <td className="text-right tabular-nums">{formatMoney(r.amount)}</td>
                          {quote.perOrderFee > 0 && <td className="text-right font-semibold tabular-nums text-primary">{formatMoney(r.amount + quote.perOrderFee)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {scenarios && (
                <div className="card overflow-hidden">
                  <h2 className="border-b border-border px-4 py-3 font-semibold"><Tr>Costo mensual según volumen</Tr></h2>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th><Tr>Concepto</Tr></th>
                          {volumes.map((v) => (
                            <th key={v} className="text-right">
                              {v.toLocaleString("es-MX")} <Tr>pedidos</Tr>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scenarios.rows.map((r) => (
                          <tr key={r.label}>
                            <td>{r.label}</td>
                            {r.values.map((v, j) => (
                              <td key={j} className="text-right tabular-nums">
                                {formatMoney(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td><Tr>Total mensual (con IVA)</Tr></td>
                          {scenarios.total.map((v, j) => (
                            <td key={j} className="text-right tabular-nums text-kurier">
                              {formatMoney(v)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          {(quote.notes || quote.terms) && (
            <div className="card grid gap-4 p-5 text-sm md:grid-cols-2">
              {quote.notes && (
                <div>
                  <div className="label"><Tr>Notas</Tr></div>
                  <p className="whitespace-pre-line">{quote.notes}</p>
                </div>
              )}
              {quote.terms && (
                <div>
                  <div className="label"><Tr>Condiciones comerciales</Tr></div>
                  <p className="whitespace-pre-line">{quote.terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {editable && (
            <div className="card p-4">
              <div className="label mb-2"><Tr>Estatus</Tr></div>
              <div className="grid gap-1">
                {(accepted ? (["BORRADOR", "ENVIADA", "ACEPTADA", "RECHAZADA"] as const) : (["BORRADOR", "ENVIADA", "RECHAZADA"] as const)).map((st) => {
                  const current = quote.status === st;
                  return (
                    <Form key={st} action={setQuoteStatus.bind(null, quote.id, st)}>
                      <button
                        className={`flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-sm transition-colors ${current ? "bg-muted" : "hover:bg-muted/60"}`}
                        disabled={current}
                        aria-current={current ? "true" : undefined}
                      >
                        <StatusBadge status={st} />
                        {current && <Check className="size-4 text-primary" />}
                      </button>
                    </Form>
                  );
                })}
              </div>
            </div>
          )}
          <div className="card space-y-2 p-4">
            {quote.status === "ACEPTADA" && (
              <Form action={acceptQuote.bind(null, quote.id)}>
                <ConfirmButton message={t("¿Volver a pasar las {v0} tarifa(s) de esta propuesta a las tarifas negociadas de {v1}?", { v0: rateCount, v1: party.name })} className="btn-secondary w-full">
                  <BadgeCheck className="size-4" /> <Tr>Actualizar tarifas del cliente</Tr>
                </ConfirmButton>
              </Form>
            )}
            <Form action={duplicateQuote.bind(null, quote.id)}>
              <SubmitButton className="btn-secondary w-full" pendingText={t("Duplicando…")}>
                <Copy className="size-4" /> <Tr>Duplicar cotización</Tr>
              </SubmitButton>
            </Form>
            {quote.invoices.length === 0 && (
              <Form action={deleteQuote.bind(null, quote.id)}>
                <ConfirmButton message={t("¿Eliminar la cotización {v0}?", { v0: quote.folio })} className="btn-danger w-full">
                  <Trash2 className="size-4" /> <Tr>Eliminar</Tr>
                </ConfirmButton>
              </Form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
