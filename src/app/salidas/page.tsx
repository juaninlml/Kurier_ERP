import Link from "next/link";
import { FileText, PackageMinus, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Empty } from "@/components/kit";
import { FilterBar, PdfLink } from "@/components/list";
import { formatDate, formatNumber } from "@/lib/money";
import { exitTotals } from "@/lib/goods-exit";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Salidas de mercancía") };
}

export default async function ExitsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getT();
  const { q = "" } = await searchParams;
  const like = { contains: q, mode: "insensitive" as const };
  const exits = await prisma.goodsExit.findMany({
    where: q
      ? {
          OR: [
            { folio: like },
            { reference: like },
            { carrier: like },
            { plates: like },
            { client: { name: like } },
            { items: { some: { sku: like } } },
          ],
        }
      : undefined,
    include: { client: { select: { name: true } }, items: { select: { boxes: true, piecesPerBox: true } } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 300,
  });

  return (
    <div>
      <PageHeader
        title={t("Salidas de mercancía")}
        subtitle={t("Cajas que salen del almacén por SKU, con su hoja de salida en PDF.")}
        actions={
          <>
            <a href="/api/pdf/salida/blanco" target="_blank" className="btn-secondary">
              <FileText className="size-4" /> {t("Formato en blanco")}
            </a>
            <Link href="/salidas/nueva" className="btn-primary">
              <Plus className="size-4" /> {t("Nueva salida")}
            </Link>
          </>
        }
      />
      <div className="card overflow-hidden">
        <FilterBar basePath="/salidas" q={q} placeholder={t("Buscar por folio, cliente, SKU, referencia o placas")} />
        {exits.length === 0 ? (
          <Empty
            icon={PackageMinus}
            action={
              !q ? (
                <Link href="/salidas/nueva" className="btn-primary">
                  <Plus className="size-4" /> {t("Registrar la primera salida")}
                </Link>
              ) : undefined
            }
          >
            {q ? t("Ninguna salida coincide con la búsqueda.") : t("Aún no hay salidas de mercancía registradas.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Folio")}</th>
                  <th>{t("Fecha")}</th>
                  <th>{t("Cliente")}</th>
                  <th>{t("Orden / referencia")}</th>
                  <th>{t("Transportista")}</th>
                  <th className="text-right">{t("SKU")}</th>
                  <th className="text-right">{t("Cajas")}</th>
                  <th className="text-right">{t("Piezas")}</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {exits.map((e) => {
                  const tot = exitTotals(e.items);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/salidas/${e.id}`} className="font-mono font-medium text-primary hover:underline">
                          {e.folio}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(`${e.date}T12:00:00Z`)}
                        {e.time && <span className="ml-1 text-xs text-muted-foreground">{e.time}</span>}
                      </td>
                      <td>{e.client.name}</td>
                      <td className="text-muted-foreground">{e.reference || "—"}</td>
                      <td className="text-muted-foreground">
                        {e.carrier || "—"}
                        {e.plates && <span className="block font-mono text-xs">{e.plates}</span>}
                      </td>
                      <td className="text-right tabular-nums">{e.items.length}</td>
                      <td className="text-right tabular-nums">{formatNumber(tot.boxes)}</td>
                      <td className="text-right font-medium tabular-nums">{formatNumber(tot.pieces)}</td>
                      <td>
                        <div className="flex justify-end">
                          <PdfLink href={`/api/pdf/salida/${e.id}`} />
                          <PdfLink href={`/api/pdf/salida/${e.id}`} download />
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
