import Link from "next/link";
import { AlarmClock, CalendarClock, Plus, Receipt, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, Empty, Stat } from "@/components/kit";
import { FilterBar } from "@/components/list";
import { addDays, formatDate, formatMoney, round2, toInputDate } from "@/lib/money";
import { addBillPayment } from "@/app/actions/payables";
import { InvoicePayButton } from "@/components/InvoicePayButton";
import { INVOICE_STATUSES } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";
import { ExportButton } from "@/components/ExportButton";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Cuentas por pagar") };
}

const OPEN = ["PENDIENTE", "PARCIAL"];

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const t = await getT();
  const { status, q = "" } = await searchParams;
  const now = new Date();
  const soon = addDays(now, 7);
  const where =
    status === "VENCIDA"
      ? { status: { in: OPEN }, dueDate: { lt: now } }
      : status && (INVOICE_STATUSES as readonly string[]).includes(status)
        ? { status }
        : {};
  const search = q
    ? {
        OR: [
          { folio: { contains: q, mode: "insensitive" as const } },
          { concept: { contains: q, mode: "insensitive" as const } },
          { supplier: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};
  const [bills, open, grouped] = await Promise.all([
    prisma.supplierBill.findMany({
      where: { ...where, ...search },
      include: { supplier: { select: { id: true, name: true } } },
      // Primero lo que vence antes
      orderBy: [{ dueDate: "asc" }, { id: "desc" }],
      take: 200,
    }),
    prisma.supplierBill.findMany({ where: { status: { in: OPEN } }, select: { total: true, paidTotal: true, dueDate: true } }),
    prisma.supplierBill.groupBy({ by: ["status"], where: search, _count: true }),
  ]);
  const owed = (rows: typeof open) => round2(rows.reduce((a, b) => a + b.total - b.paidTotal, 0));
  const payable = owed(open);
  const lateOpen = open.filter((b) => b.dueDate < now);
  const dueSoon = open.filter((b) => b.dueDate >= now && b.dueDate <= soon);
  const counts: Record<string, number> = { ...Object.fromEntries(grouped.map((g) => [g.status, g._count])), VENCIDA: lateOpen.length };
  const today = toInputDate(now);

  return (
    <div>
      <PageHeader
        title={t("Cuentas por pagar")}
        subtitle={t("Facturas y recibos de proveedores. Cada pago se registra como egreso en contabilidad.")}
        actions={
          <>
            <ExportButton kind="cuentas-por-pagar" />
            <Link href="/cuentas-por-pagar/nueva" className="btn-primary">
              <Plus className="size-4" /> {t("Nueva cuenta por pagar")}
            </Link>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Por pagar")} value={formatMoney(payable)} hint={t("{n} cuenta(s) abiertas", { n: open.length })} icon={Wallet} />
        <Stat
          label={t("Vencido")}
          value={formatMoney(owed(lateOpen))}
          tone={lateOpen.length ? "neg" : undefined}
          hint={lateOpen.length ? t("{n} cuenta(s)", { n: lateOpen.length }) : t("Nada vencido")}
          icon={AlarmClock}
          href={lateOpen.length ? "/cuentas-por-pagar?status=VENCIDA" : undefined}
        />
        <Stat
          label={t("Vence en 7 días")}
          value={formatMoney(owed(dueSoon))}
          hint={dueSoon.length ? t("{n} cuenta(s)", { n: dueSoon.length }) : t("Nada por vencer")}
          icon={CalendarClock}
        />
      </div>
      <div className="card overflow-hidden">
        <FilterBar
          basePath="/cuentas-por-pagar"
          q={q}
          status={status}
          statuses={[...INVOICE_STATUSES, "VENCIDA"]}
          counts={counts}
          placeholder={t("Buscar folio, concepto o proveedor")}
        />
        {bills.length === 0 ? (
          <Empty
            icon={Receipt}
            action={
              !q && !status ? (
                <Link href="/cuentas-por-pagar/nueva" className="btn-primary">
                  <Plus className="size-4" /> {t("Registrar la primera")}
                </Link>
              ) : undefined
            }
          >
            {q || status ? t("Ninguna cuenta coincide con el filtro.") : t("Aún no hay cuentas por pagar. Registra aquí las facturas que te cobran tus proveedores.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Proveedor")}</th>
                  <th>{t("Concepto")}</th>
                  <th>{t("Fecha")}</th>
                  <th>{t("Vence")}</th>
                  <th>{t("Estatus")}</th>
                  <th className="text-right">{t("Total")}</th>
                  <th className="text-right">{t("Saldo")}</th>
                  <th className="w-12">
                    <span className="sr-only">{t("Acciones")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const balance = b.status === "CANCELADA" ? 0 : round2(b.total - b.paidTotal);
                  const late = balance > 0 && b.dueDate < now;
                  return (
                    <tr key={b.id} className={b.status === "CANCELADA" ? "opacity-60" : ""}>
                      <td>
                        <Link href={`/cuentas-por-pagar/${b.id}`} className="font-medium text-primary hover:underline">
                          {b.supplier.name}
                        </Link>
                        {b.folio && <div className="text-xs text-muted-foreground">{b.folio}</div>}
                      </td>
                      <td className="max-w-72 truncate" title={b.concept}>
                        {b.concept}
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">{formatDate(b.issueDate)}</td>
                      <td className={`whitespace-nowrap ${late ? "font-medium text-rose-600" : "text-muted-foreground"}`}>{formatDate(b.dueDate)}</td>
                      <td>
                        <StatusBadge status={late ? "VENCIDA" : b.status} />
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(b.total)}</td>
                      <td className="text-right font-medium tabular-nums">{balance > 0 ? formatMoney(balance) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-1 text-right">
                        {balance > 0 ? (
                          <InvoicePayButton
                            action={addBillPayment.bind(null, b.id)}
                            folio={b.folio || b.concept}
                            client={b.supplier.name}
                            balance={balance}
                            today={today}
                            note={t("Se registra como egreso en contabilidad.")}
                          />
                        ) : (
                          <span className="inline-block size-8" aria-hidden="true" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
