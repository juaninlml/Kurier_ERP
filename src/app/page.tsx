import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Stat, StatusBadge, Empty } from "@/components/ui";
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

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle={`Resumen de ${monthName}`}
        actions={
          <>
            <Link href="/cotizaciones/nueva" className="btn-secondary">
              + Cotización
            </Link>
            <Link href="/facturas/nueva" className="btn-primary">
              + Factura
            </Link>
          </>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ingresos del mes" value={formatMoney(stmt.incomeTotal)} tone="pos" />
        <Stat label="Egresos del mes" value={formatMoney(stmt.expenseTotal)} tone="neg" />
        <Stat label="Por cobrar" value={formatMoney(ar.total)} hint={overdue > 0 ? `${formatMoney(overdue)} vencido` : "Todo al corriente"} />
        <Stat label="Cotizaciones abiertas" value={formatMoney(pipeline)} hint={`${openQuotes.length} cotización(es)`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(
          [
            ["Últimas facturas", "/facturas", recentInvoices],
            ["Últimas cotizaciones", "/cotizaciones", recentQuotes],
          ] as const
        ).map(([title, href, rows]) => (
          <div key={title} className="card overflow-x-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold">{title}</h2>
              <Link href={href} className="text-sm text-brand hover:underline">
                Ver todas →
              </Link>
            </div>
            {rows.length === 0 ? (
              <Empty>Nada por aquí todavía.</Empty>
            ) : (
              <table className="table">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`${href}/${r.id}`} className="font-medium text-brand hover:underline">
                          {r.folio}
                        </Link>
                        <div className="text-xs text-slate-500">{formatDate(r.issueDate)}</div>
                      </td>
                      <td>{r.client.name}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
