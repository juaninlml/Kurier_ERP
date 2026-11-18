import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const clients = await prisma.client.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { rfc: { contains: q } }, { legalName: { contains: q } }] } : undefined,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { invoices: { where: { status: { in: ["PENDIENTE", "PARCIAL"] } }, select: { total: true, paidTotal: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${clients.length} cliente(s)`}
        actions={
          <Link href="/clientes/nuevo" className="btn-primary">
            + Nuevo cliente
          </Link>
        }
      />
      <form className="mb-4">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o RFC…" className="input max-w-sm" />
      </form>
      <div className="card overflow-x-auto">
        {clients.length === 0 ? (
          <Empty>No hay clientes todavía.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>RFC</th>
                <th>Contacto</th>
                <th className="text-right">Saldo por cobrar</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const balance = c.invoices.reduce((a, i) => a + i.total - i.paidTotal, 0);
                return (
                  <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                    <td>
                      <Link href={`/clientes/${c.id}`} className="font-medium text-brand hover:underline">
                        {c.name}
                      </Link>
                      {c.legalName && <div className="text-xs text-slate-500">{c.legalName}</div>}
                    </td>
                    <td className="font-mono text-xs">{c.rfc || "—"}</td>
                    <td>
                      <div>{c.contactName || "—"}</div>
                      <div className="text-xs text-slate-500">{c.email}</div>
                    </td>
                    <td className="text-right tabular-nums">{balance > 0 ? formatMoney(balance) : "—"}</td>
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
