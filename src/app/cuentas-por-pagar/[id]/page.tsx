import { Ban, Landmark, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { addBillPayment, cancelBill, deleteBill, deleteBillPayment, reactivateBill, updateBill } from "@/app/actions/payables";
import { PageHeader, StatusBadge, Stat, Field, Panel } from "@/components/kit";
import { BillForm } from "@/components/BillForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyButton } from "@/components/CopyButton";
import { Form } from "@/components/Form";
import { Tr } from "@/components/Tr";
import { formatDate, formatMoney, round2, toInputDate } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";

import { NumberField } from "@/components/NumberField";
export const dynamic = "force-dynamic";

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const bill = await prisma.supplierBill.findUnique({
    where: { id },
    include: { supplier: true, payments: { orderBy: { date: "asc" } } },
  });
  if (!bill) notFound();
  const [suppliers, settings] = await Promise.all([
    prisma.supplier.findMany({
      where: { OR: [{ active: true }, { id: bill.supplierId }] },
      select: { id: true, name: true, category: true, creditDays: true },
      orderBy: { name: "asc" },
    }),
    getSettings(),
  ]);
  const s = bill.supplier;
  const cancelled = bill.status === "CANCELADA";
  const balance = cancelled ? 0 : round2(bill.total - bill.paidTotal);
  const now = new Date();
  const late = balance > 0 && bill.dueDate < now;
  const daysLeft = Math.ceil((bill.dueDate.getTime() - now.getTime()) / 86_400_000);
  const hasBank = !!(s.clabe || s.accountNumber || s.bank);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={bill.concept}
        back={{ href: "/cuentas-por-pagar", label: t("Cuentas por pagar") }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={late ? "VENCIDA" : bill.status} />
            <Link href={`/proveedores/${s.id}`} className="hover:text-primary">
              {s.name}
            </Link>
            {bill.folio && <span>· {bill.folio}</span>}
            <span>
              · {t(bill.category)}
            </span>
          </span>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total" value={formatMoney(bill.total)} hint={bill.tax ? t("IVA {v0}", { v0: formatMoney(bill.tax) }) : undefined} />
        <Stat label="Pagado" value={formatMoney(bill.paidTotal)} hint={t("{n} pago(s)", { n: bill.payments.length })} />
        <Stat
          label="Saldo"
          value={formatMoney(balance)}
          tone={late ? "neg" : undefined}
          hint={
            cancelled
              ? t("Cancelada")
              : balance <= 0
                ? t("Liquidada")
                : late
                  ? t("Venció el {v0}", { v0: formatDate(bill.dueDate) })
                  : daysLeft === 0
                    ? t("Vence hoy")
                    : t("Vence en {n} día(s) · {v0}", { n: daysLeft, v0: formatDate(bill.dueDate) })
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Panel title={t("Pagos registrados")} description={t("Cada pago aparece como egreso en contabilidad.")}>
            {bill.payments.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                <Tr>Aún no hay pagos.</Tr>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Fecha")}</th>
                      <th>{t("Método")}</th>
                      <th>{t("Referencia")}</th>
                      <th className="text-right">{t("Monto")}</th>
                      <th>
                        <span className="sr-only">{t("Acciones")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                        <td>{t(p.method)}</td>
                        <td className="text-muted-foreground">{p.reference || "—"}</td>
                        <td className="text-right tabular-nums">{formatMoney(p.amount)}</td>
                        <td className="text-right">
                          <Form action={deleteBillPayment.bind(null, p.id)}>
                            <ConfirmButton message={t("¿Eliminar este pago? También se eliminará el egreso en contabilidad.")} className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline">
                              <Trash2 className="size-4" /> <Tr>Eliminar</Tr>
                            </ConfirmButton>
                          </Form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {!cancelled && (
            <section>
              <h2 className="mb-3 font-semibold">
                <Tr>Datos de la cuenta</Tr>
              </h2>
              <BillForm
                action={updateBill.bind(null, bill.id)}
                suppliers={suppliers}
                defaultTaxRate={settings.defaultTaxRate}
                submitLabel={t("Guardar cambios")}
                lockSupplier={bill.payments.length > 0}
                editing
                bill={{
                  supplierId: bill.supplierId,
                  folio: bill.folio,
                  concept: bill.concept,
                  category: bill.category,
                  issueDate: toInputDate(bill.issueDate),
                  dueDate: toInputDate(bill.dueDate),
                  total: bill.total,
                  tax: bill.tax,
                  notes: bill.notes,
                }}
              />
            </section>
          )}
          {cancelled && bill.notes && (
            <div className="card p-5 text-sm">
              <div className="label">
                <Tr>Notas</Tr>
              </div>
              <p className="whitespace-pre-line">{bill.notes}</p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {balance > 0 && (
            <Form action={addBillPayment.bind(null, bill.id)} className="card space-y-3 p-4">
              <h2 className="font-semibold">
                <Tr>Registrar pago</Tr>
              </h2>
              <p className="text-xs text-muted-foreground">
                <Tr>Se registra automáticamente como egreso en contabilidad.</Tr>
              </p>
              <Field label="Monto">
                <NumberField name="amount" defaultValue={balance} required className="input text-right tabular-nums" />
              </Field>
              <Field label="Fecha">
                <input name="date" type="date" defaultValue={toInputDate(now)} required className="input" />
              </Field>
              <Field label="Método">
                <select name="method" className="input">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(m)}
                    </option>
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

          {balance > 0 && (
            <Panel title={t("Datos para pagar")} bodyClassName="space-y-3 p-4 text-sm">
              {hasBank ? (
                <>
                  {s.bank && <Row label={t("Banco")} value={s.bank} />}
                  {s.clabe && <Row label="CLABE" value={s.clabe} mono copy={t("Copiar")} />}
                  {s.accountNumber && <Row label={t("Número de cuenta")} value={s.accountNumber} mono copy={t("Copiar")} />}
                  <Row label={t("Beneficiario")} value={s.legalName || s.name} />
                </>
              ) : (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <Landmark className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <Tr>Sin datos bancarios.</Tr>{" "}
                    <Link href={`/proveedores/${s.id}`} className="text-primary hover:underline">
                      <Tr>Agrégalos en la ficha del proveedor.</Tr>
                    </Link>
                  </span>
                </p>
              )}
            </Panel>
          )}

          <div className="card space-y-2 p-4">
            {cancelled ? (
              <>
                <Form action={reactivateBill.bind(null, bill.id)}>
                  <SubmitButton className="btn-secondary w-full">
                    <Tr>Reactivar cuenta</Tr>
                  </SubmitButton>
                </Form>
                <Form action={deleteBill.bind(null, bill.id)}>
                  <ConfirmButton message={t("¿Eliminar esta cuenta por pagar? No se puede deshacer.")} className="btn-danger w-full">
                    <Trash2 className="size-4" /> <Tr>Eliminar</Tr>
                  </ConfirmButton>
                </Form>
              </>
            ) : bill.payments.length === 0 ? (
              <Form action={cancelBill.bind(null, bill.id)}>
                <ConfirmButton message={t("¿Cancelar esta cuenta por pagar?")} className="btn-danger w-full">
                  <Ban className="size-4" /> <Tr>Cancelar cuenta</Tr>
                </ConfirmButton>
              </Form>
            ) : (
              <p className="text-xs text-muted-foreground">
                <Tr>Para cancelarla, elimina primero los pagos registrados.</Tr>
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <span className={mono ? "font-mono tabular-nums" : "font-medium"}>{value}</span>
        {copy && <CopyButton value={value} label={copy} />}
      </div>
    </div>
  );
}
