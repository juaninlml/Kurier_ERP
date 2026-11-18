import { FileDown, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/ClientForm";
import { PageHeader, StatusBadge, Stat, Empty } from "@/components/kit";
import { formatDate, formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      quotes: { orderBy: { issueDate: "desc" }, take: 20 },
      invoices: { orderBy: { issueDate: "desc" }, take: 50 },
    },
  });
  if (!client) notFound();

  const open = client.invoices.filter((i) => i.status === "PENDIENTE" || i.status === "PARCIAL");
  const balance = open.reduce((a, i) => a + i.total - i.paidTotal, 0);
  const billed = client.invoices.filter((i) => i.status !== "CANCELADA").reduce((a, i) => a + i.total, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={client.name}
        subtitle={client.legalName || undefined}
        back={{ href: "/clientes", label: "Clientes" }}
        actions={
          <>
            <a href={`/api/pdf/estado-cuenta/${client.id}`} target="_blank" className="btn-secondary">
              <FileDown className="size-4" /> Estado de cuenta PDF
            </a>
            <Link href={`/cotizaciones/nueva?clientId=${client.id}`} className="btn-secondary">
              <Plus className="size-4" /> Cotización
            </Link>
            <Link href={`/facturas/nueva?clientId=${client.id}`} className="btn-primary">
              <Plus className="size-4" /> Factura
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Saldo por cobrar" value={formatMoney(balance)} hint={`${open.length} factura(s) abiertas`} />
        <Stat label="Facturado (histórico)" value={formatMoney(billed)} />
        <Stat label="Cotizaciones" value={String(client.quotes.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <h2 className="border-b border-border px-4 py-3 font-semibold">Facturas</h2>
          {client.invoices.length === 0 ? (
            <Empty>Sin facturas.</Empty>
          ) : (
            <table className="table">
              <tbody>
                {client.invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/facturas/${i.id}`} className="font-medium text-primary hover:underline">
                        {i.folio}
                      </Link>
                      <div className="text-xs text-muted-foreground">{formatDate(i.issueDate)}</div>
                    </td>
                    <td>
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card overflow-x-auto">
          <h2 className="border-b border-border px-4 py-3 font-semibold">Cotizaciones</h2>
          {client.quotes.length === 0 ? (
            <Empty>Sin cotizaciones.</Empty>
          ) : (
            <table className="table">
              <tbody>
                {client.quotes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <Link href={`/cotizaciones/${q.id}`} className="font-medium text-primary hover:underline">
                        {q.folio}
                      </Link>
                      <div className="text-xs text-muted-foreground">{formatDate(q.issueDate)}</div>
                    </td>
                    <td>
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="text-right tabular-nums">{formatMoney(q.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Datos del cliente</h2>
      <ClientForm action={updateClient.bind(null, client.id)} client={client} />
    </div>
  );
}
