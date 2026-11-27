import { Ban, Download, Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { addPayment, cancelInvoice, deletePayment, reactivateInvoice } from "@/app/actions/invoices";
import { PageHeader, StatusBadge, Field } from "@/components/kit";
import { DocumentView } from "@/components/DocumentView";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate, round2, toInputDate } from "@/lib/money";
import { exchangeRateLabel, formatCurrency, toMxn } from "@/lib/currency";
import { PAYMENT_METHODS } from "@/lib/constants";
import { Form } from "@/components/Form";
import { DriveButton } from "@/components/DriveButton";
import { Tr } from "@/components/Tr";
import { getLang, getT } from "@/lib/i18n/server";
import { docText } from "@/lib/i18n/doc-text";

import { NumberField } from "@/components/NumberField";
export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const lang = await getLang();
  const id = Number((await params).id);
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      quote: { select: { id: true, folio: true } },
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: { date: "asc" } },
    },
  });
  if (!inv) notFound();
  const balance = round2(inv.total - inv.paidTotal);
  const cancelled = inv.status === "CANCELADA";
  const late = !cancelled && balance > 0 && inv.dueDate < new Date();
  const editable = !cancelled && inv.payments.length === 0;
  const cny = inv.currency === "CNY";
  const money = (n: number) => formatCurrency(n, inv.currency);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("Factura {v0}", { v0: inv.folio })}
        back={{ href: "/facturas", label: t("Facturas") }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={late ? "VENCIDA" : inv.status} />
            <Link href={`/clientes/${inv.clientId}`} className="hover:text-primary">
              {inv.client.name}
            </Link>
            <Tr>· Emitida</Tr> {formatDate(inv.issueDate)} <Tr>· Vence</Tr> {formatDate(inv.dueDate)}
            {inv.quote && (
              <>
                <Tr>· De</Tr>{" "}
                <Link href={`/cotizaciones/${inv.quote.id}`} className="underline hover:text-primary">
                  {inv.quote.folio}
                </Link>
              </>
            )}
          </span>
        }
        actions={
          <>
            <a href={`/api/pdf/factura/${inv.id}`} target="_blank" className="btn-secondary">
              <Eye className="size-4" /> <Tr>Ver PDF</Tr>
            </a>
            <a href={`/api/pdf/factura/${inv.id}?download`} className="btn-primary">
              <Download className="size-4" /> <Tr>Descargar PDF</Tr>
            </a>
            <DriveButton refKey={`factura:${inv.id}`} path={`/facturas/${inv.id}`} />
            {editable && (
              <Link href={`/facturas/${inv.id}/editar`} className="btn-secondary">
                <Pencil className="size-4" /> <Tr>Editar</Tr>
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {(inv.period || inv.volume || inv.storage || inv.terms) && (
            <div className="card overflow-hidden">
              <dl className="divide-y divide-border text-sm">
                {[
                  { label: t("Periodo facturado"), value: docText(inv.period, lang) },
                  { label: t("Volumen del periodo"), value: docText(inv.volume, lang) },
                  { label: t("Almacenamiento"), value: docText(inv.storage, lang, "storage") },
                  { label: t("Condiciones de pago"), value: docText(inv.terms, lang) },
                ]
                  .filter((r) => r.value)
                  .map((r) => (
                    <div key={r.label} className="grid grid-cols-[200px_1fr] gap-3 px-4 py-2">
                      <dt className="font-medium text-primary">{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
          <DocumentView
            kind="invoice"
            items={inv.items}
            subtotal={inv.subtotal}
            discount={inv.discount}
            tax={inv.tax}
            total={inv.total}
            currency={inv.currency}
            extra={
              <>
                {cny && (
                  <div className="mt-2 space-y-1 border-t border-dashed border-border pt-2 text-xs text-muted-foreground">
                    <div className="font-medium uppercase tracking-wide"><Tr>Equivalente en MXN</Tr></div>
                    <div className="flex justify-between">
                      <dt><Tr>Subtotal sin IVA</Tr></dt>
                      <dd className="tabular-nums">{formatCurrency(toMxn(inv.subtotal, inv))}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>IVA</dt>
                      <dd className="tabular-nums">{formatCurrency(toMxn(inv.tax, inv))}</dd>
                    </div>
                    <div className="flex justify-between font-medium text-foreground">
                      <dt><Tr>Total</Tr></dt>
                      <dd className="tabular-nums">{formatCurrency(toMxn(inv.total, inv))}</dd>
                    </div>
                    <div>{exchangeRateLabel(inv.exchangeRate)}</div>
                  </div>
                )}
                {inv.paidTotal > 0 && (
                <>
                  <div className="flex justify-between pt-1 text-emerald-700">
                    <dt><Tr>Pagado</Tr></dt>
                    <dd className="tabular-nums">{money(inv.paidTotal)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold text-kurier">
                    <dt><Tr>Saldo</Tr></dt>
                    <dd className="tabular-nums">{money(balance)}</dd>
                  </div>
                </>
                )}
              </>
            }
          />
          {inv.notes && (
            <div className="card p-5 text-sm">
              <div className="label"><Tr>Notas</Tr></div>
              <p className="whitespace-pre-line">{inv.notes}</p>
            </div>
          )}
          <div className="card overflow-x-auto">
            <h2 className="border-b border-border px-4 py-3 font-semibold"><Tr>Pagos registrados</Tr></h2>
            {inv.payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground"><Tr>Aún no hay pagos.</Tr></p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th><Tr>Fecha</Tr></th>
                    <th><Tr>Método</Tr></th>
                    <th><Tr>Referencia</Tr></th>
                    <th className="text-right"><Tr>Monto</Tr></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.date)}</td>
                      <td>{p.method}</td>
                      <td className="text-muted-foreground">{p.reference || "—"}</td>
                      <td className="text-right tabular-nums">
                        {money(p.amount)}
                        {cny && <div className="text-xs text-muted-foreground">{formatCurrency(toMxn(p.amount, inv))} MXN</div>}
                      </td>
                      <td className="text-right">
                        <Form action={deletePayment.bind(null, p.id)}>
                          <ConfirmButton message={t("¿Eliminar este pago? También se eliminará el ingreso en contabilidad.")} className="text-xs text-rose-600 hover:underline">
                            <Trash2 className="size-4" /> <Tr>Eliminar</Tr>
                          </ConfirmButton>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          {!cancelled && balance > 0 && (
            <Form action={addPayment.bind(null, inv.id)} className="card space-y-3 p-4">
              <h2 className="font-semibold"><Tr>Registrar pago</Tr></h2>
              <p className="text-xs text-muted-foreground"><Tr>Se registra automáticamente como ingreso en contabilidad.</Tr></p>
              {cny && (
                <p className="text-xs text-muted-foreground">
                  {t("Monto en yuanes (CNY). En contabilidad entra en pesos con el tipo de cambio de la factura ({v0}).", { v0: exchangeRateLabel(inv.exchangeRate) })}
                </p>
              )}
              <Field label={cny ? "Monto (CNY)" : "Monto"}>
                <NumberField name="amount" defaultValue={balance} required className="input text-right tabular-nums" />
              </Field>
              <Field label="Fecha">
                <input name="date" type="date" defaultValue={toInputDate(new Date())} required className="input" />
              </Field>
              <Field label="Método">
                <select name="method" className="input">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{t(m)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Referencia">
                <input name="reference" className="input" placeholder={t("SPEI, # de cheque…")} />
              </Field>
              <SubmitButton className="btn-kurier w-full" pendingText={t("Registrando…")}>
                <Tr>Registrar pago</Tr>
              </SubmitButton>
            </Form>
          )}
          <div className="card space-y-2 p-4">
            {cancelled ? (
              <Form action={reactivateInvoice.bind(null, inv.id)}>
                <SubmitButton className="btn-secondary w-full"><Tr>Reactivar factura</Tr></SubmitButton>
              </Form>
            ) : inv.payments.length === 0 ? (
              <Form action={cancelInvoice.bind(null, inv.id)}>
                <ConfirmButton message={t("¿Cancelar la factura {v0}?", { v0: inv.folio })} className="btn-danger w-full">
                  <Ban className="size-4" /> <Tr>Cancelar factura</Tr>
                </ConfirmButton>
              </Form>
            ) : (
              <p className="text-xs text-muted-foreground"><Tr>Para cancelar o editar, elimina primero los pagos registrados.</Tr></p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
