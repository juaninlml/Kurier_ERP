import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, FileText, Plus, ReceiptText, Wallet, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Stat, StatusBadge, Empty, Panel } from "@/components/kit";
import { formatDate, formatMoney, round2 } from "@/lib/money";
import { incomeStatement, parseRange, receivables } from "@/lib/reports";
import { getLang, getT } from "@/lib/i18n/server";
import { localeOf } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  const { from, to } = parseRange();
  const [stmt, ar, openQuotes, recentInvoices, recentQuotes] = await Promise.all([
    incomeStatement(from, to),
    receivables(),
    prisma.quote.findMany({ where: { status: { in: ["BORRADOR", "ENVIADA", "ACEPTADA"] } }, select: { total: true } }),
    prisma.invoice.findMany({ orderBy: { id: "desc" }, take: 6, include: { client: { select: { name: true } } } }),
    prisma.quote.findMany({ orderBy: { id: "desc" }, take: 6, include: { client: { select: { name: true } } } }).then((qs) => qs.map((q) => ({ ...q, client: { name: q.client?.name ?? `${q.prospectName || t("Prospecto")} (${t("prospecto")})` } }))),
  ]);
  const pipeline = round2(openQuotes.reduce((a, q) => a + q.total, 0));
  const overdue = round2(ar.total - ar.byBucket.corriente);
  const monthName = from.toLocaleDateString(localeOf(lang), { month: "long", year: "numeric", timeZone: "UTC" });
  const net = round2(stmt.incomeTotal - stmt.expenseTotal);

  return (
    <div>
      <PageHeader
        title={t("Inicio")}
        subtitle={
          <>
            {t("Resumen de")} <span className="font-medium text-foreground">{monthName}</span> · {t("utilidad del mes")}{" "}
            <span className={net >= 0 ? "font-medium text-emerald-700" : "font-medium text-rose-700"}>{formatMoney(net)}</span>
          </>
        }
        actions={
          <>
            <Link href="/cotizaciones/nueva" className="btn-secondary">
              <FileText className="size-4" /> {t("Nueva cotización")}
            </Link>
            <Link href="/facturas/nueva" className="btn-primary">
              <Plus className="size-4" /> {t("Nueva factura")}
            </Link>
          </>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("Ingresos del mes")} value={formatMoney(stmt.incomeTotal)} tone="pos" icon={ArrowUpRight} href="/contabilidad" />
        <Stat label={t("Egresos del mes")} value={formatMoney(stmt.expenseTotal)} tone="neg" icon={ArrowDownRight} href="/contabilidad" />
        <Stat
          label={t("Por cobrar")}
          value={formatMoney(ar.total)}
          hint={overdue > 0 ? t("{amount} vencido", { amount: formatMoney(overdue) }) : t("Todo al corriente")}
          icon={Wallet}
          href={overdue > 0 ? "/facturas?status=VENCIDA" : "/facturas"}
        />
        <Stat label={t("Cotizaciones abiertas")} value={formatMoney(pipeline)} hint={t("{n} en seguimiento", { n: openQuotes.length })} icon={ClipboardList} href="/cotizaciones" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {(
          [
            ["Últimas facturas", "/facturas", recentInvoices, ReceiptText, "/facturas/nueva"],
            ["Últimas cotizaciones", "/cotizaciones", recentQuotes, FileText, "/cotizaciones/nueva"],
          ] as const
        ).map(([title, href, rows, Icon, newHref]) => (
          <Panel
            key={title}
            title={t(title)}
            action={
              <Link href={href} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
                {t("Ver todas")} <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {rows.length === 0 ? (
              <Empty
                icon={Icon}
                action={
                  <Link href={newHref} className="btn-secondary">
                    <Plus className="size-4" /> {t("Crear")}
                  </Link>
                }
              >
                {t("Nada por aquí todavía.")}
              </Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link href={`${href}/${r.id}`} className="font-medium text-primary hover:underline">
                            {r.folio}
                          </Link>
                          <div className="text-xs text-muted-foreground">{formatDate(r.issueDate)}</div>
                        </td>
                        <td className="max-w-48 truncate">{r.client.name}</td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="text-right font-medium tabular-nums">{formatMoney(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
