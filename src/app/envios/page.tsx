import Link from "next/link";
import { CalendarDays, MapPinned, MessageCircle, Plus, Truck, Boxes } from "lucide-react";
import { siteOrigin, trackingUrl, whatsappLink, whatsappMessage } from "@/lib/tracking";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, Empty, Stat } from "@/components/kit";
import { FilterBar, PdfLink } from "@/components/list";
import { SHIPMENT_STATUSES } from "@/lib/constants";
import { localParts } from "@/lib/attendance";
import { formatDate, formatMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Envíos última milla") };
}

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const t = await getT();
  const { status, q = "" } = await searchParams;
  const cfg = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true } });
  const today = localParts(new Date(), cfg?.timezone || "America/Mexico_City").date;
  const dayStart = new Date(`${today}T06:00:00Z`); // medianoche CDMX
  const monthStart = new Date(`${today.slice(0, 7)}-01T06:00:00Z`);
  const ins = "insensitive" as const;
  const search: Prisma.ShipmentWhereInput = q
    ? { OR: [{ tracking: { contains: q, mode: ins } }, { reference: { contains: q, mode: ins } }, { destName: { contains: q, mode: ins } }, { destZip: { contains: q } }, { client: { name: { contains: q, mode: ins } } }] }
    : {};
  const live = { status: { not: "CANCELADA" } };
  const [list, grouped, todayCount, month, byZone] = await Promise.all([
    prisma.shipment.findMany({ where: { ...search, ...(status ? { status } : {}) }, include: { client: { select: { name: true } } }, orderBy: { id: "desc" }, take: 200 }),
    prisma.shipment.groupBy({ by: ["status"], where: search, _count: true }),
    prisma.shipment.count({ where: { ...live, createdAt: { gte: dayStart } } }),
    prisma.shipment.aggregate({ where: { ...live, createdAt: { gte: monthStart } }, _count: true, _sum: { price: true } }),
    prisma.shipment.groupBy({ by: ["zone"], where: { ...live, createdAt: { gte: monthStart } }, _count: true }),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count]));
  const origin = await siteOrigin();
  const zone = (z: number) => byZone.find((x) => x.zone === z)?._count ?? 0;

  return (
    <div>
      <PageHeader
        title={t("Envíos última milla")}
        subtitle={t("Guías de entrega en la Ciudad de México, cotizadas por zona con el tarifario de última milla. Formato 4 × 6 para impresora térmica.")}
        actions={
          <>
            <Link href="/envios/almacenamientos" className="btn-secondary">
              <Boxes className="size-4" /> {t("Almacenamientos y rutas")}
            </Link>
            <Link href="/envios/nuevo" className="btn-primary">
              <Plus className="size-4" /> {t("Crear envío")}
            </Link>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Guías de hoy" value={String(todayCount)} icon={CalendarDays} />
        <Stat label="Guías del mes" value={String(month._count)} hint={t("{v0} sin IVA", { v0: formatMoney(month._sum.price ?? 0) })} icon={Truck} />
        <Stat label="Por zona (mes)" value={`${zone(1)} · ${zone(2)}`} hint={t("Zona 1 · Zona 2")} icon={MapPinned} />
      </div>
      <section className="card overflow-hidden">
        <FilterBar basePath="/envios" q={q} status={status} statuses={SHIPMENT_STATUSES} counts={counts} placeholder={t("Buscar guía, destinatario, CP o cliente")} />
        {list.length === 0 ? (
          <Empty icon={Truck} action={<Link href="/envios/nuevo" className="btn-primary"><Plus className="size-4" /> {t("Crear envío")}</Link>}>
            {q || status ? t("No hay guías con ese filtro.") : t("Aún no hay guías de última milla.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Guía")}</th>
                  <th>{t("Fecha")}</th>
                  <th>{t("Destinatario")}</th>
                  <th>{t("Alcaldía")}</th>
                  <th>{t("Cliente")}</th>
                  <th>{t("Estatus")}</th>
                  <th className="text-right">{t("Precio")}</th>
                  <th className="w-20">
                    <span className="sr-only">{t("Guía PDF")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/envios/${s.id}`} className="font-mono text-sm font-medium text-primary hover:underline">
                        {s.tracking}
                      </Link>
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap">{formatDate(s.createdAt)}</td>
                    <td>
                      <div className="font-medium">{s.destName}</div>
                      <div className="text-[11px] text-muted-foreground">{s.destZip}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      {s.borough} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">Z{s.zone}</span>
                      <div className="text-[11px] text-muted-foreground">{s.serviceLevel === "DIA_SIGUIENTE" ? t("Día siguiente") : t("Mismo día")}</div>
                    </td>
                    <td className="text-muted-foreground">{s.client?.name ?? "—"}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(s.price)}</td>
                    <td className="py-1 text-right">
                      <div className="flex items-center justify-end">
                        <a
                          href={whatsappLink(s.destPhone, whatsappMessage(s, trackingUrl(origin, s.tracking)))}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t("Enviar por WhatsApp a {v0}", { v0: s.destName })}
                          title={t("Enviar por WhatsApp")}
                          className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                        >
                          <MessageCircle className="size-4" />
                        </a>
                        <PdfLink href={`/api/pdf/guia/${s.id}`} label="Imprimir guía" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
