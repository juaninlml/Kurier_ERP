import { ChevronDown, Copy, Plus, Tags, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { createRate, deleteRate, updateRate, copyRatesFromQuote } from "@/app/actions/rates";
import { Panel, Empty } from "./kit";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { ConfirmButton } from "./ConfirmButton";
import { RateFields } from "./RateFields";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { rateLabel } from "@/lib/totals";

/** Conceptos que ya conocemos del WMS (de importaciones previas y del tarifario), para sugerirlos. */
async function knownWmsConcepts() {
  const [imports, services] = await Promise.all([
    prisma.wmsImport.findMany({ select: { payload: true }, orderBy: { id: "desc" }, take: 30 }),
    prisma.service.findMany({ where: { NOT: { wmsConcept: "" } }, select: { wmsConcept: true } }),
  ]);
  const set = new Set<string>(["Procesamiento de pedido", "Picking pieza/bulto adicional", "Envío de pedido", "Concepto especial"]);
  for (const s of services) s.wmsConcept.split(";").forEach((c) => c.trim() && set.add(c.trim()));
  for (const i of imports) {
    try {
      for (const l of JSON.parse(i.payload).lines ?? []) if (l.concept) set.add(String(l.concept));
    } catch {
      /* payload dañado: se ignora */
    }
  }
  return [...set];
}

/** Panel "Tarifas negociadas" de la ficha del cliente. */
export async function ClientRates({ clientId }: { clientId: number }) {
  const [rates, services, quotes, wmsConcepts] = await Promise.all([
    prisma.clientRate.findMany({ where: { clientId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.service.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.quote.findMany({ where: { clientId }, orderBy: { id: "desc" }, select: { id: true, folio: true, status: true }, take: 20 }),
    knownWmsConcepts(),
  ]);

  return (
    <Panel
      title="Tarifas negociadas"
      description="Precios especiales de este cliente. Se aplican al facturar y al importar movimientos del WMS; lo que no esté aquí usa el tarifario estándar."
      action={
        quotes.length > 0 ? (
          <Form action={copyRatesFromQuote.bind(null, clientId)} className="flex items-center gap-2">
            <select name="quoteId" className="input h-8 w-auto text-xs" defaultValue={quotes[0].id} aria-label="Cotización">
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.folio}
                </option>
              ))}
            </select>
            <SubmitButton className="btn-secondary h-8 text-xs" pendingText="Copiando…">
              <Copy className="size-3.5" /> Copiar de cotización
            </SubmitButton>
          </Form>
        ) : undefined
      }
    >
      {rates.length === 0 ? (
        <Empty icon={Tags}>Este cliente todavía no tiene tarifas negociadas; se usa el tarifario estándar.</Empty>
      ) : (
        <ul className="divide-y">
          {rates.map((r) => (
            <li key={r.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      {r.code && <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>}
                      {!r.active && <Badge variant="secondary">Inactiva</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.wmsConcept ? (
                        <>
                          WMS: <span className="text-foreground">{r.wmsConcept}</span>
                        </>
                      ) : (
                        <span className="text-amber-700">Sin concepto del WMS: no se aplicará al importar</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold whitespace-nowrap text-kurier tabular-nums">{rateLabel(r, formatMoney)}</div>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t bg-muted/30 px-5 py-4">
                  <Form action={updateRate.bind(null, r.id)} className="space-y-3">
                    <RateFields rate={r} wmsConcepts={wmsConcepts} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="active" value="on" defaultChecked={r.active} /> Activa
                        <input type="hidden" name="active" value="off" />
                      </label>
                      <SubmitButton className="btn-primary">Guardar tarifa</SubmitButton>
                    </div>
                  </Form>
                  <Form action={deleteRate.bind(null, r.id)} className="mt-2">
                    <ConfirmButton message={`¿Eliminar la tarifa “${r.name}”?`} className="btn-danger h-8 text-xs">
                      <Trash2 className="size-3.5" /> Eliminar
                    </ConfirmButton>
                  </Form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <details className="group border-t">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-primary hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          <Plus className="size-4" /> Agregar tarifa
        </summary>
        <div className="border-t bg-muted/30 px-5 py-4">
          <Form action={createRate.bind(null, clientId)} className="space-y-3">
            <RateFields services={services} wmsConcepts={wmsConcepts} />
            <div className="flex justify-end">
              <SubmitButton>Agregar tarifa</SubmitButton>
            </div>
          </Form>
        </div>
      </details>
    </Panel>
  );
}
