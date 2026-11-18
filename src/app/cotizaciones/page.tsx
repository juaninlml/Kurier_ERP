import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, Empty } from "@/components/kit";
import { FilterBar, PdfLink } from "@/components/list";
import { formatDate, formatMoney } from "@/lib/money";
import { QUOTE_STATUSES } from "@/lib/constants";
import { quoteParty } from "@/lib/quote-party";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cotizaciones" };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q = "" } = await searchParams;
  const search = q ? { OR: [{ folio: { contains: q, mode: "insensitive" as const } }, { client: { name: { contains: q, mode: "insensitive" as const } } }, { prospectName: { contains: q, mode: "insensitive" as const } }] } : {};
  const [quotes, grouped] = await Promise.all([
    prisma.quote.findMany({
      where: { ...(status ? { status } : {}), ...search },
      include: { client: { select: { name: true, legalName: true, rfc: true } } },
      orderBy: { id: "desc" },
      take: 200,
    }),
    prisma.quote.groupBy({ by: ["status"], where: search, _count: true }),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle="Propuestas comerciales para prospectos. Al aceptarse, el prospecto se da de alta como cliente con sus tarifas."
        actions={
          <Link href="/cotizaciones/nueva" className="btn-primary">
            <Plus className="size-4" /> Nueva cotización
          </Link>
        }
      />
      <div className="card overflow-hidden">
        <FilterBar basePath="/cotizaciones" q={q} status={status} statuses={QUOTE_STATUSES} counts={counts} placeholder="Buscar folio, prospecto o cliente" />
        {quotes.length === 0 ? (
          <Empty
            icon={FileText}
            action={
              !q && !status ? (
                <Link href="/cotizaciones/nueva" className="btn-primary">
                  <Plus className="size-4" /> Crear la primera
                </Link>
              ) : undefined
            }
          >
            {q || status ? "Ninguna cotización coincide con el filtro." : "Aún no hay cotizaciones."}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Cliente</th>
                  <th>Emisión</th>
                  <th>Vigencia</th>
                  <th>Estatus</th>
                  <th className="text-right">Total estimado</th>
                  <th className="w-12">
                    <span className="sr-only">PDF</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((qt) => {
                  const expired = qt.validUntil < now && (qt.status === "BORRADOR" || qt.status === "ENVIADA");
                  return (
                    <tr key={qt.id}>
                      <td>
                        <Link href={`/cotizaciones/${qt.id}`} className="font-medium text-primary hover:underline">
                          {qt.folio}
                        </Link>
                      </td>
                      <td>
                        <div className="font-medium">{quoteParty(qt).name}</div>
                        {!qt.client && <div className="text-xs text-muted-foreground">Prospecto</div>}
                      </td>
                      <td className="text-muted-foreground">{formatDate(qt.issueDate)}</td>
                      <td className={expired ? "text-rose-600" : "text-muted-foreground"}>
                        {formatDate(qt.validUntil)}
                        {expired && <span className="ml-1.5 text-xs">(vencida)</span>}
                      </td>
                      <td>
                        <StatusBadge status={qt.status} />
                      </td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(qt.total)}</td>
                      <td className="py-1 text-right">
                        <PdfLink href={`/api/pdf/cotizacion/${qt.id}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {quotes.length === 200 && <p className="mt-3 text-xs text-muted-foreground">Se muestran las 200 más recientes. Usa la búsqueda para encontrar otras.</p>}
    </div>
  );
}
