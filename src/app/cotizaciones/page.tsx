import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, Empty } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/money";
import { QUOTE_STATUSES, STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q = "" } = await searchParams;
  const quotes = await prisma.quote.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ folio: { contains: q } }, { client: { name: { contains: q } } }] } : {}),
    },
    include: { client: { select: { name: true } } },
    orderBy: { id: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle={`${quotes.length} resultado(s)`}
        actions={
          <Link href="/cotizaciones/nueva" className="btn-primary">
            + Nueva cotización
          </Link>
        }
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Folio o cliente…" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ""} className="input w-auto">
          <option value="">Todos los estatus</option>
          {QUOTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto">
        {quotes.length === 0 ? (
          <Empty>No hay cotizaciones.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Vigencia</th>
                <th>Estatus</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((qt) => {
                const expired = qt.validUntil < new Date() && (qt.status === "BORRADOR" || qt.status === "ENVIADA");
                return (
                  <tr key={qt.id}>
                    <td>
                      <Link href={`/cotizaciones/${qt.id}`} className="font-medium text-brand hover:underline">
                        {qt.folio}
                      </Link>
                    </td>
                    <td>{qt.client.name}</td>
                    <td>{formatDate(qt.issueDate)}</td>
                    <td className={expired ? "text-rose-600" : ""}>{formatDate(qt.validUntil)}</td>
                    <td>
                      <StatusBadge status={qt.status} />
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(qt.total)}</td>
                    <td className="text-right">
                      <a href={`/api/pdf/cotizacion/${qt.id}`} target="_blank" className="text-xs text-slate-500 hover:text-brand">
                        PDF
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
