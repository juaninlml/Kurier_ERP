import Link from "next/link";
import { AlarmClock, CircleCheck, FileUp, Plus, ReceiptText, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, Empty, Stat } from "@/components/kit";
import { FilterBar, PdfLink } from "@/components/list";
import { formatDate, formatMoney, round2, toInputDate } from "@/lib/money";
import { addPayment } from "@/app/actions/invoices";
import { InvoicePayButton } from "@/components/InvoicePayButton";
import { INVOICE_STATUSES } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Facturas") };
}

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const t = await getT();
  const { status, q = "" } = await searchParams;
  const now = new Date();
  const where =
    status === "VENCIDA"
      ? { status: { in: ["PENDIENTE", "PARCIAL"] }, dueDate: { lt: now } }
      : status
        ? { status }
        : {};
  const search = q ? { OR: [{ folio: { contains: q, mode: "insensitive" as const } }, { client: { name: { contains: q, mode: "insensitive" as const } } }] } : {};
  const [invoices, open, grouped, pendingImports] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...where, ...search },
      include: { client: { select: { name: true } } },
      orderBy: { id: "desc" },
      take: 200,
    }),
    prisma.invoice.findMany({ where: { status: { in: ["PENDIENTE", "PARCIAL"] } }, select: { total: true, paidTotal: true, dueDate: true } }),
    prisma.invoice.groupBy({ by: ["status"], where: search, _count: true }),
    prisma.wmsImport.count({ where: { status: "PENDIENTE" } }),
  ]);
  const receivable = round2(open.reduce((a, i) => a + i.total - i.paidTotal, 0));
  const lateOpen = open.filter((i) => i.dueDate < now);
  const overdue = round2(lateOpen.reduce((a, i) => a + i.total - i.paidTotal, 0));
  const counts: Record<string, number> = { ...Object.fromEntries(grouped.map((g) => [g.status, g._count])), VENCIDA: lateOpen.length };

  return (
    <div>
      <PageHeader
        title={t("Facturas")}
        subtitle={t("Formato interno de facturación y estado de cuenta (no sustituye al CFDI).")}
        actions={
          <>
            <Link href="/facturas/importar" className="btn-secondary">
              <FileUp className="size-4" /> {t("Importar del WMS")}
              {pendingImports > 0 && <span className="rounded-md bg-kurier px-1.5 text-[11px] text-white tabular-nums">{pendingImports}</span>}
            </Link>
            <Link href="/facturas/nueva" className="btn-primary">
              <Plus className="size-4" /> {t("Nueva factura")}
            </Link>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Por cobrar")} value={formatMoney(receivable)} hint={t("{n} factura(s) abiertas", { n: open.length })} icon={Wallet} />
        <Stat
          label={t("Vencido")}
          value={formatMoney(overdue)}
          tone={overdue > 0 ? "neg" : undefined}
          hint={lateOpen.length ? t("{n} factura(s)", { n: lateOpen.length }) : t("Nada vencido")}
          icon={AlarmClock}
          href={lateOpen.length ? "/facturas?status=VENCIDA" : undefined}
        />
        <Stat label={t("Al corriente")} value={formatMoney(round2(receivable - overdue))} icon={CircleCheck} />
      </div>
      <div className="card overflow-hidden">
        <FilterBar basePath="/facturas" q={q} status={status} statuses={[...INVOICE_STATUSES, "VENCIDA"]} counts={counts} placeholder={t("Buscar folio o cliente")} />
        {invoices.length === 0 ? (
          <Empty
            icon={ReceiptText}
            action={
              !q && !status ? (
                <Link href="/facturas/nueva" className="btn-primary">
                  <Plus className="size-4" /> {t("Crear la primera")}
                </Link>
              ) : undefined
            }
          >
            {q || status ? t("Ninguna factura coincide con el filtro.") : t("Aún no hay facturas.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Folio")}</th>
                  <th>{t("Cliente")}</th>
                  <th>{t("Emisión")}</th>
                  <th>{t("Vencimiento")}</th>
                  <th>{t("Estatus")}</th>
                  <th className="text-right">{t("Total")}</th>
                  <th className="text-right">{t("Saldo")}</th>
                  <th className="w-28">
                    <span className="sr-only">{t("Acciones")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const balance = inv.status === "CANCELADA" ? 0 : round2(inv.total - inv.paidTotal);
                  const late = balance > 0 && inv.dueDate < now;
                  return (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/facturas/${inv.id}`} className="font-medium text-primary hover:underline">
                          {inv.folio}
                        </Link>
                      </td>
                      <td className="font-medium">{inv.client.name}</td>
                      <td className="text-muted-foreground">{formatDate(inv.issueDate)}</td>
                      <td className={late ? "font-medium text-rose-600" : "text-muted-foreground"}>{formatDate(inv.dueDate)}</td>
                      <td>
                        <StatusBadge status={late ? "VENCIDA" : inv.status} />
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(inv.total)}</td>
                      <td className="text-right font-medium tabular-nums">{balance > 0 ? formatMoney(balance) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-1 text-right">
                        <div className="flex items-center justify-end">
                          <PdfLink href={`/api/pdf/factura/${inv.id}`} />
                          <PdfLink href={`/api/pdf/factura/${inv.id}`} download />
                          {balance > 0 ? (
                            <InvoicePayButton action={addPayment.bind(null, inv.id)} folio={inv.folio} client={inv.client.name} balance={balance} today={toInputDate(new Date())} />
                          ) : (
                            <span className="inline-block size-8" aria-hidden="true" />
                          )}
                        </div>
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
