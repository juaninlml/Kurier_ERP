import { notFound } from "next/navigation";
import { Download, Printer, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { deleteExit, updateExit } from "@/app/actions/goods-exits";
import { ExitForm } from "@/components/ExitForm";
import { Form } from "@/components/Form";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader } from "@/components/kit";
import { exitFormData } from "@/lib/goods-exit-data";
import { exitTotals } from "@/lib/goods-exit";
import { formatDate, formatNumber } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const e = await prisma.goodsExit.findUnique({ where: { id: Number((await params).id) || 0 }, select: { folio: true } });
  return { title: e ? `${(await getT())("Salida")} ${e.folio}` : "Salida" };
}

export default async function ExitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nueva?: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  const { nueva } = await searchParams;
  const e = id
    ? await prisma.goodsExit.findUnique({ where: { id }, include: { client: { select: { name: true } }, items: { orderBy: { position: "asc" } } } })
    : null;
  if (!e) notFound();
  const { clients, skuHints } = await exitFormData(e.clientId);
  const tot = exitTotals(e.items);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`${t("Salida")} ${e.folio}`}
        subtitle={`${e.client.name} · ${formatDate(`${e.date}T12:00:00Z`)}${e.time ? ` ${e.time}` : ""} · ${formatNumber(tot.boxes)} ${t("cajas")} · ${formatNumber(tot.pieces)} ${t("piezas")}`}
        back={{ href: "/salidas", label: t("Salidas de mercancía") }}
        actions={
          <>
            <Form action={deleteExit.bind(null, e.id)}>
              <ConfirmButton message={t("¿Eliminar esta salida? No se puede deshacer.")} className="btn-secondary text-rose-600">
                <Trash2 className="size-4" /> {t("Eliminar")}
              </ConfirmButton>
            </Form>
            <a href={`/api/pdf/salida/${e.id}?download`} className="btn-secondary">
              <Download className="size-4" /> {t("Descargar PDF")}
            </a>
            <a href={`/api/pdf/salida/${e.id}`} target="_blank" className="btn-primary">
              <Printer className="size-4" /> {t("Hoja de salida")}
            </a>
          </>
        }
      />
      {nueva && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {t("Salida registrada. Imprime la hoja de salida para que la firmen el almacén y el transportista.")}
        </p>
      )}
      <ExitForm
        action={updateExit.bind(null, e.id)}
        clients={clients}
        skuHints={skuHints}
        today={e.date}
        exit={{
          clientId: e.clientId,
          date: e.date,
          time: e.time,
          reference: e.reference,
          carrier: e.carrier,
          plates: e.plates,
          driverName: e.driverName,
          deliveredBy: e.deliveredBy,
          notes: e.notes,
          items: e.items.map((i) => ({ sku: i.sku, boxes: i.boxes, piecesPerBox: i.piecesPerBox })),
        }}
      />
    </div>
  );
}
