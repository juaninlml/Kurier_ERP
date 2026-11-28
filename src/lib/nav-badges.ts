import { cache } from "react";
import { prisma } from "./db";
import { canRead, canWrite } from "./permissions";
import { companyToday } from "./orders";
import { lastWeek, weeklyPending } from "./weekly-billing";
import { stockAlerts } from "./inventory";
import type { NavBadge } from "@/components/nav-items";

type T = (s: string, v?: Record<string, string | number>) => string;

/**
 * Pendientes que se muestran como contador en la barra lateral, solo de lo que el rol puede ver.
 * Consultas de conteo ligeras; un fallo nunca rompe el menú (esa opción queda sin contador).
 */
export const navBadges = cache(async (role: string, t: T): Promise<Record<string, NavBadge>> => {
  const now = new Date();
  const out: Record<string, NavBadge> = {};
  const safe = <X,>(p: Promise<X>) => p.catch((e) => (console.error("[nav-badges]", e), null));
  const today = await safe(companyToday());

  const [overdue, weekly, low, apOverdue] = await Promise.all([
    canRead(role, "cobranza") ? safe(prisma.invoice.count({ where: { status: { in: ["PENDIENTE", "PARCIAL"] }, dueDate: { lt: now } } })) : null,
    canWrite(role, "facturas") && today ? safe(weeklyPending(lastWeek(today)).then((w) => w.pending)) : null,
    canRead(role, "ordenes") && today ? safe(stockAlerts(today).then((a) => a.length)) : null,
    canRead(role, "cxp") ? safe(prisma.supplierBill.count({ where: { status: { in: ["PENDIENTE", "PARCIAL"] }, dueDate: { lt: now } } })) : null,
  ]);

  if (overdue) out["/cobranza"] = { n: overdue, tone: "alert", title: t("{n} factura(s) vencida(s)", { n: overdue }) };
  if (weekly) out["/facturas/semanal"] = { n: weekly, tone: "info", title: t("{n} cliente(s) de la semana pasada sin factura", { n: weekly }) };
  if (low) out["/ordenes"] = { n: low, tone: "alert", title: t("{n} insumo(s) por agotarse", { n: low }) };
  if (apOverdue) out["/cuentas-por-pagar"] = { n: apOverdue, tone: "alert", title: t("{n} pago(s) a proveedores vencido(s)", { n: apOverdue }) };
  return out;
});
