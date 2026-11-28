import { prisma } from "./db";
import { canRead, canWrite } from "./permissions";
import { companyToday, rangeLabel } from "./orders";
import { lastWeek, weeklyPending } from "./weekly-billing";
import { stockAlerts } from "./inventory";
import { collectionBoard } from "./collections";
import { isWorkday, localParts, toMin, weekdayOf } from "./attendance";
import { formatMoney } from "./money";
import type { T } from "./i18n/core";

/*
 * "Pendientes de hoy" de Inicio: lo que alguien tiene que atender hoy, de las secciones que su
 * rol puede ver, con un enlace directo. Cada consulta es independiente: si una falla, las demás
 * se muestran igual.
 */

export type PendingKind = "capture" | "supplies" | "weekly" | "overdue" | "promise" | "payables" | "stock" | "shipments" | "attendance";
export type PendingItem = { kind: PendingKind; tone: "alert" | "warn" | "info"; title: string; detail: string; href: string; cta: string };

const safe = <X,>(p: Promise<X>) => p.catch((e) => (console.error("[pendientes]", e), null));

export async function todayPending(role: string, t: T, locale: string): Promise<PendingItem[]> {
  const today = await companyToday();
  const sunday = weekdayOf(today) === 0;
  const s = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true, lateToleranceMin: true } });
  const tz = s?.timezone || "America/Mexico_City";
  const nowMin = localParts(new Date(), tz).minutes;
  const in7 = new Date(Date.now() + 7 * 86_400_000);

  const [capture, weekly, board, payables, stock, shipments, attendance] = await Promise.all([
    // Captura de órdenes e insumos del día (lunes a sábado)
    canRead(role, "ordenes") && !sunday
      ? safe(
          Promise.all([
            prisma.dailyOrder.groupBy({ by: ["clientId"], where: { workDate: today, quantity: { gt: 0 } }, _sum: { quantity: true } }),
            prisma.dailySupply.groupBy({ by: ["clientId"], where: { workDate: today, quantity: { gt: 0 } }, _sum: { quantity: true } }),
          ]),
        )
      : null,
    canWrite(role, "facturas") ? safe(weeklyPending(lastWeek(today))) : null,
    canRead(role, "cobranza") ? safe(collectionBoard(today)) : null,
    canRead(role, "cxp")
      ? safe(prisma.supplierBill.aggregate({ where: { status: { in: ["PENDIENTE", "PARCIAL"] }, dueDate: { lte: in7 } }, _count: { _all: true }, _sum: { total: true, paidTotal: true } }))
      : null,
    canRead(role, "ordenes") ? safe(stockAlerts(today)) : null,
    canRead(role, "envios") ? safe(prisma.shipment.count({ where: { status: { in: ["GENERADA", "EN_RUTA"] }, createdAt: { lt: new Date(`${today}T06:00:00Z`) } } })) : null,
    canRead(role, "nomina") && !sunday
      ? safe(
          Promise.all([
            prisma.employee.findMany({ where: { active: true, kioskSecret: { not: "" } }, select: { id: true, workDays: true, scheduleStart: true } }),
            prisma.punch.groupBy({ by: ["employeeId"], where: { workDate: today, deleted: false } }),
          ]),
        )
      : null,
  ]);

  const out: PendingItem[] = [];

  if (capture) {
    const [orders, supplies] = capture;
    if (!orders.length) {
      // Antes de mediodía no es un pendiente: todavía se está surtiendo.
      if (nowMin >= 12 * 60)
        out.push({ kind: "capture", tone: "warn", title: t("Aún no se capturan las órdenes de hoy"), detail: t("Órdenes por oleada de cada cliente"), href: "/ordenes", cta: t("Capturar") });
    } else {
      const sup = new Map(supplies.map((x) => [x.clientId, x._sum.quantity ?? 0]));
      const off = orders.filter((o) => (sup.get(o.clientId) ?? 0) !== (o._sum.quantity ?? 0)).length;
      if (off > 0)
        out.push({
          kind: "supplies",
          tone: "info",
          title: t("{n} cliente(s) con insumos sin cuadrar hoy", { n: off }),
          detail: t("Las piezas de empaque deben sumar lo mismo que sus órdenes"),
          href: "/ordenes/insumos",
          cta: t("Revisar"),
        });
    }
  }

  if (weekly && weekly.pending > 0)
    out.push({
      kind: "weekly",
      tone: "warn",
      title: t("{n} cliente(s) sin factura de la semana pasada", { n: weekly.pending }),
      detail: rangeLabel(weekly.week.from, weekly.week.to, locale),
      href: "/facturas/semanal",
      cta: t("Facturar"),
    });

  if (board) {
    const { totals } = board;
    if (totals.promisesToday + totals.promisesBroken > 0)
      out.push({
        kind: "promise",
        tone: totals.promisesBroken ? "alert" : "info",
        title: totals.promisesBroken ? t("{n} promesa(s) de pago incumplida(s)", { n: totals.promisesBroken }) : t("{n} promesa(s) de pago para hoy", { n: totals.promisesToday }),
        detail: totals.promisesBroken && totals.promisesToday ? t("y {n} para hoy", { n: totals.promisesToday }) : t("Confirma con el cliente y registra el pago"),
        href: "/cobranza?f=promesas",
        cta: t("Dar seguimiento"),
      });
    if (totals.overdue > 0)
      out.push({
        kind: "overdue",
        tone: "alert",
        title: t("{amount} vencido por cobrar", { amount: formatMoney(totals.overdue) }),
        detail: t("{n} cliente(s) con facturas vencidas", { n: totals.overdueClients }),
        href: "/cobranza?f=vencidos",
        cta: t("Cobrar"),
      });
  }

  if (payables && payables._count._all > 0) {
    const due = (payables._sum.total ?? 0) - (payables._sum.paidTotal ?? 0);
    out.push({
      kind: "payables",
      tone: "warn",
      title: t("{n} pago(s) a proveedores en los próximos 7 días", { n: payables._count._all }),
      detail: t("{amount} por pagar, incluye los vencidos", { amount: formatMoney(due) }),
      href: "/cuentas-por-pagar",
      cta: t("Ver"),
    });
  }

  if (stock && stock.length > 0)
    out.push({
      kind: "stock",
      tone: stock.some((x) => x.status === "out") ? "alert" : "warn",
      title: t("{n} insumo(s) por agotarse", { n: stock.length }),
      detail: stock
        .slice(0, 4)
        .map((x) => x.name)
        .join(", "),
      href: "/ordenes/inventario",
      cta: t("Ver inventario"),
    });

  if (shipments && shipments > 0)
    out.push({
      kind: "shipments",
      tone: "info",
      title: t("{n} envío(s) de días anteriores sin entregar", { n: shipments }),
      detail: t("Generados o en ruta"),
      href: "/envios",
      cta: t("Ver envíos"),
    });

  if (attendance) {
    const [employees, punched] = attendance;
    const done = new Set(punched.map((p) => p.employeeId));
    const tolerance = s?.lateToleranceMin ?? 10;
    // Solo quien ya debía haber llegado (hora de entrada + tolerancia) y no ha checado.
    const missing = employees.filter((e) => isWorkday(today, e) && !done.has(e.id) && nowMin > toMin(e.scheduleStart) + tolerance).length;
    if (missing > 0)
      out.push({
        kind: "attendance",
        tone: "info",
        title: t("{n} empleado(s) sin checar entrada hoy", { n: missing }),
        detail: t("Ya pasó su hora de entrada"),
        href: "/nomina/asistencias",
        cta: t("Ver asistencias"),
      });
  }

  const rank = { alert: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
