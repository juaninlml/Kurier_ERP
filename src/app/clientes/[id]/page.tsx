import { FileDown, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateClient } from "@/app/actions/clients";
import { ClientForm } from "@/components/ClientForm";
import { ClientRates } from "@/components/ClientRates";
import { PageHeader, StatusBadge, Stat, Empty } from "@/components/kit";
import { formatDate, formatMoney } from "@/lib/money";
import { brandOptions } from "@/lib/brands";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  const { nuevo } = await searchParams;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      quotes: { orderBy: { issueDate: "desc" }, take: 20 },
      invoices: { orderBy: { issueDate: "desc" }, take: 50 },
    },
  });
  if (!client) notFound();
  const brands = await brandOptions();
  const brandName = brands.length > 1 ? brands.find((b) => b.id === (client.brandId ?? 0))?.name : null;

  const open = client.invoices.filter((i) => i.status === "PENDIENTE" || i.status === "PARCIAL");
  const balance = open.reduce((a, i) => a + i.total - i.paidTotal, 0);
  const billed = client.invoices.filter((i) => i.status !== "CANCELADA").reduce((a, i) => a + i.total, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={client.name}
        subtitle={[client.legalName, brandName && `Factura: ${brandName}`].filter(Boolean).join(" · ") || undefined}
        back={{ href: "/clientes", label: t("Clientes") }}
        actions={
          <>
            <a href={`/api/pdf/estado-cuenta/${client.id}`} target="_blank" className="btn-secondary">
              <FileDown className="size-4" /> <Tr>Estado de cuenta PDF</Tr>
            </a>
            <Link href={`/cotizaciones/nueva?clientId=${client.id}`} className="btn-secondary">
              <Plus className="size-4" /> <Tr>Cotización</Tr>
            </Link>
            <Link href={`/facturas/nueva?clientId=${client.id}`} className="btn-primary">
              <Plus className="size-4" /> <Tr>Factura</Tr>
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Saldo por cobrar" value={formatMoney(balance)} hint={t("{v0} factura(s) abiertas", { v0: open.length })} />
        <Stat label="Facturado (histórico)" value={formatMoney(billed)} />
        <Stat label="Cotizaciones" value={String(client.quotes.length)} />
      </div>

      {nuevo && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Tr>Cliente creado. Ahora asígnale sus tarifas negociadas: cárgalas del tarifario o de otro cliente y ajusta los precios.</Tr>
        </div>
      )}
      <div id="tarifas" className="mb-6 scroll-mt-6">
        <ClientRates clientId={client.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <h2 className="border-b border-border px-4 py-3 font-semibold"><Tr>Facturas</Tr></h2>
          {client.invoices.length === 0 ? (
            <Empty><Tr>Sin facturas.</Tr></Empty>
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
          <h2 className="border-b border-border px-4 py-3 font-semibold"><Tr>Cotizaciones</Tr></h2>
          {client.quotes.length === 0 ? (
            <Empty><Tr>Sin cotizaciones.</Tr></Empty>
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


      <h2 className="mb-3 mt-8 font-semibold"><Tr>Datos del cliente</Tr></h2>
      <ClientForm action={updateClient.bind(null, client.id)} client={client} brands={brands} />
    </div>
  );
}
