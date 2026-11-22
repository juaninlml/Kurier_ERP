import { getSessionUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { canRead, MODULE_LABEL, type ModuleId } from "@/lib/permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { round2 } from "@/lib/money";
import { budgetRows } from "@/lib/budget";
import { profitability } from "@/lib/profitability";
import { parseRange } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Qué módulo hay que poder consultar para descargar cada exportación. */
const KINDS: Record<string, ModuleId> = {
  facturas: "facturas",
  cotizaciones: "cotizaciones",
  movimientos: "contabilidad",
  "cuentas-por-pagar": "cxp",
  clientes: "clientes",
  proveedores: "proveedores",
  nomina: "nomina",
  bitacora: "bitacora",
  presupuesto: "contabilidad",
  rentabilidad: "contabilidad",
};

const day = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

/** Exportación a Excel (CSV). Respeta los permisos del rol y queda en la bitácora. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const { kind } = await params;
  const module = KINDS[kind];
  if (!module) return new Response("Exportación desconocida", { status: 404 });
  if (!canRead(user.role, module)) return new Response("Sin permiso", { status: 403 });

  const sp = new URL(req.url).searchParams;
  const desde = day(sp.get("desde"));
  const hasta = day(sp.get("hasta"));
  const range = desde || hasta ? parseRange(desde, hasta) : null;
  const between = range ? { gte: range.from, lte: range.to } : undefined;

  let csv: string;
  switch (kind) {
    case "facturas": {
      const rows = await prisma.invoice.findMany({ where: between ? { issueDate: between } : {}, include: { client: { select: { name: true } } }, orderBy: { issueDate: "asc" } });
      csv = toCsv(
        ["Folio", "Cliente", "Emisión", "Vencimiento", "Estatus", "Subtotal", "Descuento", "IVA", "Total", "Pagado", "Saldo", "Periodo"],
        rows.map((r) => [r.folio, r.client.name, r.issueDate, r.dueDate, r.status, r.subtotal, r.discount, r.tax, r.total, r.paidTotal, r.status === "CANCELADA" ? 0 : round2(r.total - r.paidTotal), r.period]),
      );
      break;
    }
    case "cotizaciones": {
      const rows = await prisma.quote.findMany({ where: between ? { issueDate: between } : {}, include: { client: { select: { name: true } } }, orderBy: { issueDate: "asc" } });
      csv = toCsv(
        ["Folio", "Cliente / prospecto", "Fecha", "Vigencia", "Estatus", "Subtotal", "IVA", "Total"],
        rows.map((r) => [r.folio, r.client?.name ?? r.prospectName, r.issueDate, r.validUntil, r.status, r.subtotal, r.tax, r.total]),
      );
      break;
    }
    case "movimientos": {
      const rows = await prisma.transaction.findMany({
        where: between ? { date: between } : {},
        include: { client: { select: { name: true } }, supplier: { select: { name: true } }, bankLine: { select: { id: true } } },
        orderBy: [{ date: "asc" }, { id: "asc" }],
      });
      csv = toCsv(
        ["Fecha", "Tipo", "Categoría", "Concepto", "Cliente / proveedor", "Monto", "IVA", "Monto sin IVA", "Método", "Referencia", "Conciliado"],
        rows.map((r) => [r.date, r.type, r.category, r.description, r.client?.name ?? r.supplier?.name ?? "", r.amount, r.tax, round2(r.amount - r.tax), r.method, r.reference, !!r.bankLine]),
      );
      break;
    }
    case "cuentas-por-pagar": {
      const rows = await prisma.supplierBill.findMany({ where: between ? { issueDate: between } : {}, include: { supplier: { select: { name: true } } }, orderBy: { dueDate: "asc" } });
      csv = toCsv(
        ["Proveedor", "Folio", "Concepto", "Categoría", "Fecha", "Vence", "Estatus", "IVA", "Total", "Pagado", "Saldo"],
        rows.map((r) => [r.supplier.name, r.folio, r.concept, r.category, r.issueDate, r.dueDate, r.status, r.tax, r.total, r.paidTotal, r.status === "CANCELADA" ? 0 : round2(r.total - r.paidTotal)]),
      );
      break;
    }
    case "clientes": {
      const rows = await prisma.client.findMany({ orderBy: { name: "asc" } });
      csv = toCsv(
        ["Nombre", "Razón social", "RFC", "Contacto", "Correo", "Teléfono", "Dirección", "Nombre en WMS", "Activo"],
        rows.map((r) => [r.name, r.legalName, r.rfc, r.contactName, r.email, r.phone, r.address, r.wmsName, r.active]),
      );
      break;
    }
    case "proveedores": {
      const rows = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
      csv = toCsv(
        ["Nombre", "Razón social", "RFC", "Giro", "Contacto", "Correo", "Teléfono", "Días de crédito", "Banco", "CLABE", "Cuenta", "Activo"],
        rows.map((r) => [r.name, r.legalName, r.rfc, r.category, r.contactName, r.email, r.phone, r.creditDays, r.bank, r.clabe, r.accountNumber, r.active]),
      );
      break;
    }
    case "nomina": {
      const rows = await prisma.payrollLine.findMany({
        where: between ? { run: { periodStart: between } } : {},
        include: { run: { select: { periodStart: true, periodEnd: true, payDate: true, status: true } }, employee: { select: { name: true } } },
        orderBy: [{ run: { periodStart: "asc" } }, { employee: { name: "asc" } }],
      });
      csv = toCsv(
        ["Semana del", "Al", "Pago", "Estatus", "Empleado", "Salario diario", "Días", "Faltas", "Horas extra", "Importe horas extra", "Bono", "Prima vacacional", "Aguinaldo", "Otros ingresos", "Descuentos", "Bruto", "Neto", "Pagado el"],
        rows.map((r) => [
          r.run.periodStart, r.run.periodEnd, r.run.payDate, r.run.status, r.employee.name, r.dailySalary, r.days, r.absences, r.overtimeHours, r.overtime,
          r.bonus, r.vacationPremium, r.aguinaldo, r.otherIncome, r.deductions, r.gross, r.net, r.paidAt,
        ]),
      );
      break;
    }
    case "bitacora": {
      const mod = sp.get("modulo");
      const rows = await prisma.auditLog.findMany({
        where: { ...(between ? { at: between } : {}), ...(mod && MODULE_LABEL[mod] ? { module: mod } : {}) },
        orderBy: { id: "desc" },
        take: 20_000,
      });
      csv = toCsv(
        ["Fecha y hora (UTC)", "Usuario", "Acción", "Sección", "Detalle", "Registro"],
        rows.map((r) => [r.at.toISOString().replace("T", " ").slice(0, 16), r.userName, r.action, MODULE_LABEL[r.module] ?? r.module, r.summary || r.fnName, r.entityId]),
      );
      break;
    }
    case "presupuesto": {
      const year = Number(sp.get("anio")) || new Date().getFullYear();
      const month = Number(sp.get("mes")) || new Date().getMonth() + 1;
      const rows = await budgetRows(year, month);
      csv = toCsv(
        ["Tipo", "Categoría", "Presupuesto del mes", "Real del mes", "Diferencia", "Presupuesto del año a la fecha", "Real del año a la fecha"],
        rows.map((r) => [r.type, r.category, r.budget, r.actual, round2(r.actual - r.budget), r.ytdBudget, r.ytdActual]),
      );
      break;
    }
    case "rentabilidad": {
      const { from, to } = parseRange(desde, hasta);
      const r = await profitability(from, to);
      csv = toCsv(
        ["Cliente", "Órdenes", "Facturado sin IVA", "Insumos", "Costo operativo asignado", "Utilidad", "Margen %", "Ingreso por orden", "Costo por orden"],
        r.rows.map((x) => [x.name, x.orders, x.revenue, x.supplies, x.allocated, x.profit, x.margin === null ? "" : round2(x.margin * 100), x.revenuePerOrder, x.costPerOrder]),
      );
      break;
    }
    default:
      return new Response("Exportación desconocida", { status: 404 });
  }

  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        userName: user.name || user.email,
        module,
        action: "Exportó",
        fnName: `export:${kind}`,
        summary: `Exportó ${kind}${desde || hasta ? ` (${desde ?? "…"} a ${hasta ?? "…"})` : ""}`,
      },
    })
    .catch(() => {});
  return csvResponse(kind, csv);
}
