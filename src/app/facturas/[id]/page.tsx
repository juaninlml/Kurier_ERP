import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { addPayment, cancelInvoice, deletePayment, reactivateInvoice } from "@/app/actions/invoices";
import { PageHeader, StatusBadge, Field } from "@/components/ui";
import { DocumentView } from "@/components/DocumentView";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate, formatMoney, round2, toInputDate } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Factura ${inv.folio}`}
        back={{ href: "/facturas", label: "Facturas" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={late ? "VENCIDA" : inv.status} />
            <Link href={`/clientes/${inv.clientId}`} className="hover:text-brand">
              {inv.client.name}
            </Link>
            · Emitida {formatDate(inv.issueDate)} · Vence {formatDate(inv.dueDate)}
            {inv.quote && (
              <>
                · De{" "}
                <Link href={`/cotizaciones/${inv.quote.id}`} className="underline hover:text-brand">
                  {inv.quote.folio}
                </Link>
              </>
            )}
          </span>
        }
        actions={
          <>
            <a href={`/api/pdf/factura/${inv.id}`} target="_blank" className="btn-secondary">
              Ver PDF
            </a>
            <a href={`/api/pdf/factura/${inv.id}?download`} className="btn-primary">
              Descargar PDF
            </a>
            {editable && (
              <Link href={`/facturas/${inv.id}/editar`} className="btn-secondary">
                Editar
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {(inv.period || inv.volume || inv.storage || inv.terms) && (
            <div className="card overflow-hidden">
              <dl className="divide-y divide-slate-100 text-sm">
                {[
                  { label: "Periodo facturado", value: inv.period },
                  { label: "Volumen del periodo", value: inv.volume },
                  { label: "Almacenamiento", value: inv.storage },
                  { label: "Condiciones de pago", value: inv.terms },
                ]
                  .filter((r) => r.value)
                  .map((r) => (
                    <div key={r.label} className="grid grid-cols-[200px_1fr] gap-3 px-4 py-2">
                      <dt className="font-medium text-brand">{r.label}</dt>
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
            extra={
              inv.paidTotal > 0 && (
                <>
                  <div className="flex justify-between pt-1 text-emerald-700">
                    <dt>Pagado</dt>
                    <dd className="tabular-nums">{formatMoney(inv.paidTotal)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold text-accent">
                    <dt>Saldo</dt>
                    <dd className="tabular-nums">{formatMoney(balance)}</dd>
                  </div>
                </>
              )
            }
          />
          {inv.notes && (
            <div className="card p-5 text-sm">
              <div className="label">Notas</div>
              <p className="whitespace-pre-line">{inv.notes}</p>
            </div>
          )}
          <div className="card overflow-x-auto">
            <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">Pagos registrados</h2>
            {inv.payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Aún no hay pagos.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Referencia</th>
                    <th className="text-right">Monto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.date)}</td>
                      <td>{p.method}</td>
                      <td className="text-slate-500">{p.reference || "—"}</td>
                      <td className="text-right tabular-nums">{formatMoney(p.amount)}</td>
                      <td className="text-right">
                        <form action={deletePayment.bind(null, p.id)}>
                          <ConfirmButton message="¿Eliminar este pago? También se eliminará el ingreso en contabilidad." className="text-xs text-rose-600 hover:underline">
                            Eliminar
                          </ConfirmButton>
                        </form>
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
            <form action={addPayment.bind(null, inv.id)} className="card space-y-3 p-4">
              <h2 className="font-semibold">Registrar pago</h2>
              <p className="text-xs text-slate-500">Se registra automáticamente como ingreso en contabilidad.</p>
              <Field label="Monto">
                <input name="amount" type="number" step="0.01" min="0.01" max={balance} defaultValue={balance} required className="input" />
              </Field>
              <Field label="Fecha">
                <input name="date" type="date" defaultValue={toInputDate(new Date())} required className="input" />
              </Field>
              <Field label="Método">
                <select name="method" className="input">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Referencia">
                <input name="reference" className="input" placeholder="SPEI, # de cheque…" />
              </Field>
              <SubmitButton className="btn-accent w-full" pendingText="Registrando…">
                Registrar pago
              </SubmitButton>
            </form>
          )}
          <div className="card space-y-2 p-4">
            {cancelled ? (
              <form action={reactivateInvoice.bind(null, inv.id)}>
                <SubmitButton className="btn-secondary w-full">Reactivar factura</SubmitButton>
              </form>
            ) : inv.payments.length === 0 ? (
              <form action={cancelInvoice.bind(null, inv.id)}>
                <ConfirmButton message={`¿Cancelar la factura ${inv.folio}?`} className="btn-danger w-full">
                  Cancelar factura
                </ConfirmButton>
              </form>
            ) : (
              <p className="text-xs text-slate-500">Para cancelar o editar, elimina primero los pagos registrados.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
