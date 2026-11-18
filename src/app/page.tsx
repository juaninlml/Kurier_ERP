import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, FileText, Plus, ReceiptText, Wallet, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Stat, StatusBadge, Empty, Panel } from "@/components/kit";
import { formatDate, formatMoney, round2 } from "@/lib/money";
import { incomeStatement, parseRange, receivables } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { from, to } = parseRange();
  const [stmt, ar, openQuotes, recentInvoices, recentQuotes] = await Promise.all([
    incomeStatement(from, to),
    receivables(),
    prisma.quote.findMany({ where: { status: { in: ["BORRADOR", "ENVIADA", "ACEPTADA"] } }, select: { total: true } }),
    prisma.invoice.findMany({ orderBy: { id: "desc" }, take: 6, include: { client: { select: { name: true } } } }),
    prisma.quote.findMany({ orderBy: { id: "desc" }, take: 6, include: { client: { select: { name: true } } } }),
  ]);
  const pipeline = round2(openQuotes.reduce((a, q) => a + q.total, 0));
  const overdue = round2(ar.total - ar.byBucket.corriente);
  const monthName = from.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
  const net = round2(stmt.incomeTotal - stmt.expenseTotal);

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle={
          <>
            Resumen de <span className="font-medium text-foreground">{monthName}</span> · utilidad del mes{" "}
            <span className={net >= 0 ? "font-medium text-emerald-700" : "font-medium text-rose-700"}>{formatMoney(net)}</span>
          </>
        }
        actions={
          <>
            <Link href="/cotizaciones/nueva" className="btn-secondary">
              <FileText className="size-4" /> Nueva cotización
            </Link>
            <Link href="/facturas/nueva" className="btn-primary">
              <Plus className="size-4" /> Nueva factura
            </Link>
          </>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ingresos del mes" value={formatMoney(stmt.incomeTotal)} tone="pos" icon={ArrowUpRight} href="/contabilidad" />
        <Stat label="Egresos del mes" value={formatMoney(stmt.expenseTotal)} tone="neg" icon={ArrowDownRight} href="/contabilidad" />
        <Stat
          label="Por cobrar"
          value={formatMoney(ar.total)}
          hint={overdue > 0 ? `${formatMoney(overdue)} vencido` : "Todo al corriente"}
          icon={Wallet}
          href={overdue > 0 ? "/facturas?status=VENCIDA" : "/facturas"}
        />
        <Stat label="Cotizaciones abiertas" value={formatMoney(pipeline)} hint={`${openQuotes.length} en seguimiento`} icon={ClipboardList} href="/cotizaciones" />
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
            title={title}
            action={
              <Link href={href} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
                Ver todas <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            {rows.length === 0 ? (
              <Empty
                icon={Icon}
                action={
                  <Link href={newHref} className="btn-secondary">
                    <Plus className="size-4" /> Crear
                  </Link>
                }
              >
                Nada por aquí todavía.
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
