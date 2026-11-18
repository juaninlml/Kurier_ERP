import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, StatusBadge, Empty, Stat } from "@/components/ui";
import { formatDate, formatMoney, round2 } from "@/lib/money";
import { INVOICE_STATUSES, STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status, q = "" } = await searchParams;
  const now = new Date();
  const where =
    status === "VENCIDA"
      ? { status: { in: ["PENDIENTE", "PARCIAL"] }, dueDate: { lt: now } }
      : status
        ? { status }
        : {};
  const invoices = await prisma.invoice.findMany({
    where: { ...where, ...(q ? { OR: [{ folio: { contains: q, mode: "insensitive" as const } }, { client: { name: { contains: q, mode: "insensitive" as const } } }] } : {}) },
    include: { client: { select: { name: true } } },
    orderBy: { id: "desc" },
    take: 200,
  });
  const open = await prisma.invoice.findMany({ where: { status: { in: ["PENDIENTE", "PARCIAL"] } }, select: { total: true, paidTotal: true, dueDate: true } });
  const receivable = round2(open.reduce((a, i) => a + i.total - i.paidTotal, 0));
  const overdue = round2(open.filter((i) => i.dueDate < now).reduce((a, i) => a + i.total - i.paidTotal, 0));

  return (
    <div>
      <PageHeader
        title="Facturas"
        subtitle="Documentos informativos (no CFDI)"
        actions={
          <Link href="/facturas/nueva" className="btn-primary">
            + Nueva factura
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Por cobrar" value={formatMoney(receivable)} hint={`${open.length} factura(s) abiertas`} />
        <Stat label="Vencido" value={formatMoney(overdue)} tone={overdue > 0 ? "neg" : undefined} />
        <Stat label="Al corriente" value={formatMoney(round2(receivable - overdue))} />
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Folio o cliente…" className="input max-w-xs" />
        <select name="status" defaultValue={status ?? ""} className="input w-auto">
          <option value="">Todos los estatus</option>
          {[...INVOICE_STATUSES, "VENCIDA"].map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      <div className="card overflow-x-auto">
        {invoices.length === 0 ? (
          <Empty>No hay facturas.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Emisión</th>
                <th>Vencimiento</th>
                <th>Estatus</th>
                <th className="text-right">Total</th>
                <th className="text-right">Saldo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const balance = inv.status === "CANCELADA" ? 0 : round2(inv.total - inv.paidTotal);
                const late = balance > 0 && inv.dueDate < now;
                return (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/facturas/${inv.id}`} className="font-medium text-brand hover:underline">
                        {inv.folio}
                      </Link>
                    </td>
                    <td>{inv.client.name}</td>
                    <td>{formatDate(inv.issueDate)}</td>
                    <td className={late ? "font-medium text-rose-600" : ""}>{formatDate(inv.dueDate)}</td>
                    <td>
                      <StatusBadge status={late ? "VENCIDA" : inv.status} />
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(inv.total)}</td>
                    <td className="text-right tabular-nums">{balance > 0 ? formatMoney(balance) : "—"}</td>
                    <td className="text-right">
                      <a href={`/api/pdf/factura/${inv.id}`} target="_blank" className="text-xs text-slate-500 hover:text-brand">
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
