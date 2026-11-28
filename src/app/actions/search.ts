"use server";

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canRead } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { formatDate } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export type SearchHit = { group: string; label: string; hint: string; href: string };

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });
const TAKE = 5;

/**
 * Buscador general (Ctrl+K): clientes, facturas, cotizaciones, guías, proveedores y empleados.
 * Solo devuelve lo que el rol del usuario puede consultar.
 */
export async function globalSearch(raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return [];
  const me = await getSessionUser();
  if (!me) return [];
  const t = await getT();
  const can = (m: Parameters<typeof canRead>[1]) => canRead(me.role, m);
  const none = Promise.resolve([] as SearchHit[]);

  const groups = await Promise.all([
    can("clientes")
      ? prisma.client
          .findMany({ where: { OR: [{ name: ci(q) }, { legalName: ci(q) }, { rfc: ci(q) }, { wmsName: ci(q) }] }, select: { id: true, name: true, legalName: true, active: true }, take: TAKE, orderBy: { name: "asc" } })
          .then((r) => r.map((c) => ({ group: t("Clientes"), label: c.name, hint: [c.legalName, !c.active && t("Inactivo")].filter(Boolean).join(" · "), href: `/clientes/${c.id}` })))
      : none,
    can("facturas")
      ? prisma.invoice
          .findMany({
            where: { OR: [{ folio: ci(q) }, { client: { name: ci(q) } }] },
            select: { id: true, folio: true, total: true, currency: true, issueDate: true, client: { select: { name: true } } },
            take: TAKE,
            orderBy: { id: "desc" },
          })
          .then((r) => r.map((i) => ({ group: t("Facturas"), label: i.folio, hint: `${i.client.name} · ${formatCurrency(i.total, i.currency)} · ${formatDate(i.issueDate)}`, href: `/facturas/${i.id}` })))
      : none,
    can("cotizaciones")
      ? prisma.quote
          .findMany({
            where: { OR: [{ folio: ci(q) }, { prospectName: ci(q) }, { client: { name: ci(q) } }] },
            select: { id: true, folio: true, total: true, prospectName: true, client: { select: { name: true } } },
            take: TAKE,
            orderBy: { id: "desc" },
          })
          .then((r) => r.map((x) => ({ group: t("Cotizaciones"), label: x.folio, hint: `${x.client?.name ?? x.prospectName} · ${formatCurrency(x.total)}`, href: `/cotizaciones/${x.id}` })))
      : none,
    can("envios")
      ? prisma.shipment
          .findMany({ where: { OR: [{ tracking: ci(q) }, { destName: ci(q) }] }, select: { id: true, tracking: true, destName: true }, take: TAKE, orderBy: { id: "desc" } })
          .then((r) => r.map((s) => ({ group: t("Envíos"), label: s.tracking, hint: s.destName, href: `/envios/${s.id}` })))
      : none,
    can("proveedores")
      ? prisma.supplier
          .findMany({ where: { name: ci(q) }, select: { id: true, name: true }, take: TAKE, orderBy: { name: "asc" } })
          .then((r) => r.map((s) => ({ group: t("Proveedores"), label: s.name, hint: "", href: `/proveedores/${s.id}` })))
      : none,
    can("nomina")
      ? prisma.employee
          .findMany({ where: { name: ci(q) }, select: { id: true, name: true, position: true, active: true }, take: TAKE, orderBy: { name: "asc" } })
          .then((r) => r.map((e) => ({ group: t("Empleados"), label: e.name, hint: [e.position, !e.active && t("Baja")].filter(Boolean).join(" · "), href: `/nomina/empleados/${e.id}` })))
      : none,
  ]);
  return groups.flat();
}
