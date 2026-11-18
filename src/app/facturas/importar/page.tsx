import Link from "next/link";
import { FileUp, Inbox } from "lucide-react";
import { prisma } from "@/lib/db";
import { importWmsPdf } from "@/app/actions/wms";
import { PageHeader, Empty, Panel } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ImportBadge } from "@/components/ImportBadge";
import { formatDate, formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Importar del WMS" };

export default async function WmsImportsPage() {
  const imports = await prisma.wmsImport.findMany({
    orderBy: [{ status: "desc" }, { periodFrom: "desc" }, { id: "desc" }],
    include: { client: { select: { name: true } }, invoice: { select: { id: true, folio: true } } },
    take: 200,
  });
  const pending = imports.filter((i) => i.status === "PENDIENTE");

  return (
    <div>
      <PageHeader
        title="Importar del WMS"
        subtitle="Sube los estados de cobro (PDF) que genera el WMS. Se revisan con las tarifas de cada cliente antes de convertirse en factura."
        back={{ href: "/facturas", label: "Facturas" }}
      />

      <Panel title="Subir estados de cobro" description="Puedes seleccionar varios PDF a la vez (máx. 4 MB por envío). Si un folio ya se había subido, se actualiza." className="mb-6">
        <Form action={importWmsPdf} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <input type="file" name="files" accept="application/pdf" multiple required className="input flex-1" />
          <SubmitButton pendingText="Leyendo PDF…">
            <FileUp className="size-4" /> Importar
          </SubmitButton>
        </Form>
      </Panel>

      <Panel title="Estados de cobro" description={pending.length ? `${pending.length} por facturar` : "Todo facturado"}>
        {imports.length === 0 ? (
          <Empty icon={Inbox}>Aún no se ha importado ningún estado de cobro.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Folio WMS</th>
                  <th>Cliente</th>
                  <th>Periodo</th>
                  <th>Origen</th>
                  <th>Estatus</th>
                  <th className="text-right">Total WMS</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/facturas/importar/${i.id}`} className="font-medium text-primary hover:underline">
                        {i.folio}
                      </Link>
                      <div className="text-xs text-muted-foreground">Recibido {formatDate(i.createdAt)}</div>
                    </td>
                    <td>
                      {i.client ? (
                        <span className="font-medium">{i.client.name}</span>
                      ) : (
                        <span className="text-amber-700">
                          {i.clientName} <span className="text-xs">(sin asignar)</span>
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground">{i.periodLabel || "—"}</td>
                    <td className="text-xs text-muted-foreground uppercase">{i.source}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <ImportBadge status={i.status} />
                        {i.invoice && (
                          <Link href={`/facturas/${i.invoice.id}`} className="text-xs text-primary hover:underline">
                            {i.invoice.folio}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="text-right font-medium tabular-nums">{formatMoney(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
