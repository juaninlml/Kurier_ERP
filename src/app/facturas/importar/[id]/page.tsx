import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, ReceiptText, RotateCcw, Trash2, TriangleAlert, UserRound } from "lucide-react";
import { prisma } from "@/lib/db";
import { assignImportClient, deleteImport, discardImport, restoreImport } from "@/app/actions/wms";
import { previewImport } from "@/lib/wms/imports";
import { PageHeader, Panel } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ImportBadge } from "@/components/ImportBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/money";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const SOURCE: Record<string, { label: string; cls: string }> = {
  cliente: { label: "Tarifa del cliente", cls: "bg-emerald-50 text-emerald-700" },
  tarifario: { label: "Tarifario estándar", cls: "bg-blue-50 text-blue-700" },
  wms: { label: "Precio del WMS", cls: "bg-muted text-muted-foreground" },
};

export default async function WmsImportPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  const imp = await prisma.wmsImport.findUnique({ where: { id }, include: { client: true, invoice: { select: { id: true, folio: true } } } });
  if (!imp) notFound();
  const [{ statement, billing, period }, clients] = await Promise.all([
    previewImport(imp),
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const pending = imp.status === "PENDIENTE";
  const warnings = billing.groups.flatMap((g) => g.warnings.map((w) => `${g.line.description}: ${w}`));
  const unmatched = billing.groups.filter((g) => g.source === "wms" && !g.line.atCost);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={imp.folio}
        back={{ href: "/facturas/importar", label: t("Importar del WMS") }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ImportBadge status={imp.status} />
            <span>
              {imp.clientName} · {period || imp.periodLabel} · {imp.source === "api" ? t("Recibido por API") : t("Importado de PDF")}
            </span>
          </span>
        }
        actions={
          pending && imp.clientId ? (
            <Link href={`/facturas/nueva?importId=${imp.id}`} className="btn-kurier">
              <ReceiptText className="size-4" /> <Tr>Revisar y crear factura</Tr>
            </Link>
          ) : imp.invoice ? (
            <Link href={`/facturas/${imp.invoice.id}`} className="btn-secondary">
              <ReceiptText className="size-4" /> <Tr>Ver factura</Tr> {imp.invoice.folio}
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {pending && !imp.clientId && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <UserRound />
              <AlertTitle><Tr>¿A qué cliente corresponde “</Tr>{imp.clientName}”?</AlertTitle>
              <AlertDescription className="text-amber-900/80">
                <Tr>No encontramos un cliente con ese nombre. Asígnalo para aplicar sus tarifas negociadas.</Tr>
              </AlertDescription>
            </Alert>
          )}
          {warnings.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <TriangleAlert />
              <AlertTitle><Tr>Diferencias con las tarifas</Tr></AlertTitle>
              <AlertDescription className="text-amber-900/80">
                <ul className="list-disc space-y-0.5 pl-4">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p className="mt-1"><Tr>La factura usará la tarifa del ERP. Si la correcta es la del WMS, ajústala en la tarifa del cliente.</Tr></p>
              </AlertDescription>
            </Alert>
          )}

          <Panel
            title="Factura propuesta"
            description="Movimientos agrupados por concepto con la tarifa que corresponde. Podrás ajustar todo en el siguiente paso."
          >
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th><Tr>Concepto</Tr></th>
                    <th className="text-right"><Tr>Cantidad</Tr></th>
                    <th className="text-right"><Tr>Precio</Tr></th>
                    <th className="text-right"><Tr>Importe</Tr></th>
                    <th><Tr>Tarifa</Tr></th>
                  </tr>
                </thead>
                <tbody>
                  {billing.groups.map((g, i) => (
                    <tr key={g.key}>
                      <td>
                        <div className="font-medium">{g.line.description}</div>
                        <div className="text-xs text-muted-foreground">
                          WMS: {g.concept} · {g.lines.length} <Tr>movimiento(s)</Tr>{g.line.detail ? ` · ${g.line.detail}` : ""}
                        </div>
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums">
                        {formatNumber(g.line.quantity)} {g.line.unit?.toLowerCase()}
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums">{g.line.atCost ? <span className="text-muted-foreground"><Tr>Al costo</Tr></span> : formatMoney(g.line.unitPrice)}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(billing.totals.items[i].amount)}</td>
                      <td>
                        <Badge variant="outline" className={`border-transparent ${SOURCE[g.line.atCost && g.source === "wms" ? "wms" : g.source].cls}`}>
                          {g.line.atCost && g.source === "wms" ? t("Al costo (WMS)") : t(SOURCE[g.source].label)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto w-full max-w-sm space-y-1 border-t px-5 py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground"><Tr>Subtotal</Tr></dt>
                <dd className="tabular-nums">{formatMoney(billing.totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IVA</dt>
                <dd className="tabular-nums">{formatMoney(billing.totals.tax)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <dt><Tr>Total</Tr></dt>
                <dd className="text-kurier tabular-nums">{formatMoney(billing.totals.total)}</dd>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <dt><Tr>Total según el WMS</Tr></dt>
                <dd className="tabular-nums">
                  {formatMoney(statement.total)}
                  {Math.abs(billing.difference) >= 0.01 && (
                    <span className={billing.difference > 0 ? "ml-1 text-emerald-700" : "ml-1 text-rose-700"}>
                      ({billing.difference > 0 ? "+" : ""}
                      {formatMoney(billing.difference)})
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          {unmatched.length > 0 && imp.clientId && (
            <p className="text-xs text-muted-foreground">
              {unmatched.map((g) => `“${g.concept}”`).join(", ")} <Tr>no tiene tarifa del cliente ni del tarifario: se usa el precio del WMS.</Tr>{" "}
              <Link href={`/clientes/${imp.clientId}`} className="text-primary hover:underline">
                <Tr>Agregar tarifas al cliente</Tr>
              </Link>
            </p>
          )}

          <Panel title={t("Movimientos del WMS ({v0})", { v0: statement.lines.length })}>
            <details>
              <summary className="cursor-pointer px-5 py-3 text-sm text-primary hover:bg-muted/40"><Tr>Ver detalle</Tr></summary>
              <div className="overflow-x-auto border-t">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th><Tr>Fecha</Tr></th>
                      <th><Tr>Sección</Tr></th>
                      <th><Tr>Concepto</Tr></th>
                      <th><Tr>Descripción</Tr></th>
                      <th className="text-right"><Tr>Cant.</Tr></th>
                      <th className="text-right">P.U.</th>
                      <th className="text-right"><Tr>Importe</Tr></th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="whitespace-nowrap">{l.date}</td>
                        <td>{l.section}</td>
                        <td>{l.concept}</td>
                        <td className="text-muted-foreground">{l.description}</td>
                        <td className="text-right tabular-nums">
                          {formatNumber(l.quantity)} {l.unit}
                        </td>
                        <td className="text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
                        <td className="text-right tabular-nums">{formatMoney(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Panel>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-3 p-4">
            <div className="label"><Tr>Cliente en el ERP</Tr></div>
            {pending ? (
              <Form action={assignImportClient.bind(null, imp.id)} className="space-y-3">
                <select name="clientId" defaultValue={imp.clientId ?? ""} required className="input">
                  <option value="" disabled>
                    {t("Selecciona un cliente…")}
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="remember" defaultChecked={!imp.clientId} className="mt-0.5" />
                  <Tr>Recordar “</Tr>{imp.clientName}<Tr>” como el nombre de este cliente en el WMS</Tr>
                </label>
                <SubmitButton className="btn-secondary w-full">{imp.clientId ? t("Cambiar cliente") : t("Asignar cliente")}</SubmitButton>
              </Form>
            ) : (
              <div className="text-sm font-medium">{imp.client?.name ?? imp.clientName}</div>
            )}
            {imp.client && (
              <Link href={`/clientes/${imp.client.id}`} className="block text-xs text-primary hover:underline">
                <Tr>Ver tarifas negociadas de</Tr> {imp.client.name}
              </Link>
            )}
          </div>

          <div className="card space-y-1.5 p-4 text-sm">
            <div className="label"><Tr>Resumen del periodo</Tr></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground"><Tr>Pedidos</Tr></span>
              <span className="tabular-nums">{billing.orders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground"><Tr>Envíos</Tr></span>
              <span className="tabular-nums">{billing.shipments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground"><Tr>Movimientos</Tr></span>
              <span className="tabular-nums">{statement.lines.length}</span>
            </div>
          </div>

          {imp.status !== "FACTURADO" && (
            <div className="card space-y-2 p-4">
              {pending ? (
                <Form action={discardImport.bind(null, imp.id)}>
                  <SubmitButton className="btn-secondary w-full" pendingText="…">
                    <Ban className="size-4" /> <Tr>Descartar (no facturar)</Tr>
                  </SubmitButton>
                </Form>
              ) : (
                <Form action={restoreImport.bind(null, imp.id)}>
                  <SubmitButton className="btn-secondary w-full" pendingText="…">
                    <RotateCcw className="size-4" /> <Tr>Volver a pendiente</Tr>
                  </SubmitButton>
                </Form>
              )}
              <Form action={deleteImport.bind(null, imp.id)}>
                <ConfirmButton message={t("¿Eliminar la importación {v0}?", { v0: imp.folio })} className="btn-danger w-full">
                  <Trash2 className="size-4" /> <Tr>Eliminar importación</Tr>
                </ConfirmButton>
              </Form>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
