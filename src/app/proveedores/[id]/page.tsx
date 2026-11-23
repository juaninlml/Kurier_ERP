import Link from "next/link";
import { notFound } from "next/navigation";
import { AlarmClock, CalendarClock, Landmark, Plus, Receipt, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { updateSupplier } from "@/app/actions/suppliers";
import { SupplierForm } from "@/components/SupplierForm";
import { CopyButton } from "@/components/CopyButton";
import { PageHeader, Stat, Empty, Panel, StatusBadge } from "@/components/kit";
import { formatDate, formatMoney, round2 } from "@/lib/money";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  const { nuevo } = await searchParams;
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { transactions: { where: { type: "EGRESO" }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 50 } },
  });
  if (!supplier) notFound();

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [yearSum, allSum, openBills] = await Promise.all([
    prisma.transaction.aggregate({ where: { supplierId: id, type: "EGRESO", date: { gte: yearStart } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { supplierId: id, type: "EGRESO" }, _sum: { amount: true }, _count: true }),
    prisma.supplierBill.findMany({ where: { supplierId: id, status: { in: ["PENDIENTE", "PARCIAL"] } }, orderBy: { dueDate: "asc" } }),
  ]);
  const now = new Date();
  const owed = round2(openBills.reduce((a, b) => a + b.total - b.paidTotal, 0));
  const lateBills = openBills.filter((b) => b.dueDate < now);
  const last = supplier.transactions[0];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={supplier.name}
        subtitle={[supplier.legalName, supplier.category && t(supplier.category)].filter(Boolean).join(" · ") || undefined}
        back={{ href: "/proveedores", label: t("Proveedores") }}
        actions={
          <>
            <Link href={`/contabilidad?nuevo=egreso&proveedor=${supplier.id}#nuevo-movimiento`} className="btn-secondary">
              <Plus className="size-4" /> <Tr>Egreso directo</Tr>
            </Link>
            <Link href={`/cuentas-por-pagar/nueva?proveedor=${supplier.id}`} className="btn-primary">
              <Plus className="size-4" /> <Tr>Registrar factura</Tr>
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Por pagar"
          value={formatMoney(owed)}
          tone={lateBills.length ? "neg" : undefined}
          hint={lateBills.length ? t("{n} vencida(s)", { n: lateBills.length }) : t("{n} cuenta(s) abiertas", { n: openBills.length })}
          icon={lateBills.length ? AlarmClock : Receipt}
        />
        <Stat
          label="Pagado este año"
          value={formatMoney(round2(yearSum._sum.amount ?? 0))}
          hint={t("Histórico {v0} · {n} pago(s)", { v0: formatMoney(round2(allSum._sum.amount ?? 0)), n: allSum._count })}
          icon={Wallet}
        />
        <Stat
          label="Último pago"
          value={last ? formatDate(last.date) : "—"}
          hint={supplier.creditDays ? t("Crédito a {n} días", { n: supplier.creditDays }) : t("Pago de contado")}
          icon={CalendarClock}
        />
      </div>

      {nuevo && (
        <div role="status" className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Tr>Proveedor creado. Sus egresos se registran en Contabilidad eligiéndolo como proveedor.</Tr>
        </div>
      )}

      {openBills.length > 0 && (
        <Panel
          className="mb-6"
          title={t("Cuentas por pagar")}
          description={t("Facturas del proveedor pendientes de pago, de la que vence primero a la última")}
          action={
            <Link href={`/cuentas-por-pagar?q=${encodeURIComponent(supplier.name)}`} className="text-sm text-primary hover:underline">
              <Tr>Ver todas</Tr>
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Concepto")}</th>
                  <th>{t("Vence")}</th>
                  <th>{t("Estatus")}</th>
                  <th className="text-right">{t("Saldo")}</th>
                </tr>
              </thead>
              <tbody>
                {openBills.map((b) => {
                  const late = b.dueDate < now;
                  return (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/cuentas-por-pagar/${b.id}`} className="font-medium text-primary hover:underline">
                          {b.concept}
                        </Link>
                        {b.folio && <div className="text-xs text-muted-foreground">{b.folio}</div>}
                      </td>
                      <td className={`whitespace-nowrap ${late ? "font-medium text-rose-600" : "text-muted-foreground"}`}>{formatDate(b.dueDate)}</td>
                      <td>
                        <StatusBadge status={late ? "VENCIDA" : b.status} />
                      </td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(round2(b.total - b.paidTotal))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title={t("Pagos registrados")} description={t("Egresos de Contabilidad ligados a este proveedor")}>
          {supplier.transactions.length === 0 ? (
            <Empty icon={Receipt}>{t("Aún no hay egresos ligados a este proveedor.")}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Fecha")}</th>
                    <th>{t("Concepto")}</th>
                    <th>{t("Método")}</th>
                    <th className="text-right">{t("Monto")}</th>
                  </tr>
                </thead>
                <tbody>
                  {supplier.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td>
                        <Link href={`/contabilidad/movimientos/${tx.id}`} className="hover:text-primary">
                          {tx.description || t("(sin concepto)")}
                        </Link>
                        <div className="text-xs text-muted-foreground">{t(tx.category)}</div>
                      </td>
                      <td className="text-muted-foreground">
                        {t(tx.method)}
                        {tx.reference && <div className="text-xs">{tx.reference}</div>}
                      </td>
                      <td className="whitespace-nowrap text-right font-medium text-rose-700 tabular-nums">−{formatMoney(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={t("Datos para pagar")} bodyClassName="space-y-3 p-5 text-sm">
          {supplier.clabe || supplier.accountNumber || supplier.bank ? (
            <>
              <Row label="Banco" value={supplier.bank} />
              <Row label="CLABE" value={supplier.clabe} mono copy={t("Copiar")} />
              <Row label="Número de cuenta" value={supplier.accountNumber} mono copy={t("Copiar")} />
              <Row label="Beneficiario" value={supplier.legalName || supplier.name} />
            </>
          ) : (
            <p className="flex items-start gap-2 text-muted-foreground">
              <Landmark className="mt-0.5 size-4 shrink-0" aria-hidden />
              <Tr>Sin datos bancarios. Agrégalos abajo para tenerlos a la mano al pagar.</Tr>
            </p>
          )}
        </Panel>
      </div>

      <h2 className="mb-3 font-semibold">
        <Tr>Datos del proveedor</Tr>
      </h2>
      <SupplierForm action={updateSupplier.bind(null, supplier.id)} supplier={supplier} />
    </div>
  );
}

function Row({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground">
        <Tr>{label}</Tr>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={mono ? "font-mono tabular-nums" : "font-medium"}>{value}</span>
        {copy && <CopyButton value={value} label={copy} />}
      </div>
    </div>
  );
}
