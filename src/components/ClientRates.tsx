import { ChevronDown, Copy, Plus, Tags, Trash2, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { createRate, deleteRate, updateRate, copyRatesFromQuote, copyRatesFromClient, copyRatesFromTariff } from "@/app/actions/rates";
import { Panel, Empty } from "./kit";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { ConfirmButton } from "./ConfirmButton";
import { RateFields } from "./RateFields";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { rateLabel } from "@/lib/totals";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

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
  const t = await getT();
  const [rates, services, quotes, wmsConcepts, sections, donors] = await Promise.all([
    prisma.clientRate.findMany({ where: { clientId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.service.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.quote.findMany({ where: { clientId }, orderBy: { id: "desc" }, select: { id: true, folio: true, status: true }, take: 20 }),
    knownWmsConcepts(),
    prisma.serviceSection.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    prisma.client.findMany({
      where: { id: { not: clientId }, rates: { some: { active: true } } },
      select: { id: true, name: true, _count: { select: { rates: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const empty = rates.length === 0;

  // Carga rápida (sirve sobre todo a los clientes dados de alta a mano, que no vienen de una cotización).
  const quickLoad = (
    <div className={empty ? "grid gap-3 px-5 py-5 md:grid-cols-2" : "mb-4 grid gap-3 border-b pb-4 md:grid-cols-2"}>
      <Form action={copyRatesFromTariff.bind(null, clientId)} className="rounded-lg border bg-card p-3">
        <p className="text-sm font-medium"><Tr>Partir del tarifario estándar</Tr></p>
        <p className="mb-2.5 text-xs text-muted-foreground"><Tr>Copia los servicios y luego ajusta los precios negociados.</Tr></p>
        <div className="flex flex-wrap items-center gap-2">
          <select name="section" className="input h-8 w-auto min-w-40 text-xs" defaultValue="" aria-label={t("Sección del tarifario")}>
            <option value="">{t("Todo el tarifario")}</option>
            {sections.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          <SubmitButton className="btn-secondary h-8 text-xs" pendingText={t("Copiando…")}>
            <Tags className="size-3.5" /> <Tr>Cargar</Tr>
          </SubmitButton>
        </div>
      </Form>
      <Form action={copyRatesFromClient.bind(null, clientId)} className="rounded-lg border bg-card p-3">
        <p className="text-sm font-medium"><Tr>Copiar de otro cliente</Tr></p>
        <p className="mb-2.5 text-xs text-muted-foreground"><Tr>Útil cuando negociaste las mismas condiciones.</Tr></p>
        {donors.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <select name="fromClientId" className="input h-8 w-auto min-w-40 text-xs" aria-label={t("Cliente origen")}>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d._count.rates})
                </option>
              ))}
            </select>
            <SubmitButton className="btn-secondary h-8 text-xs" pendingText={t("Copiando…")}>
              <Users className="size-3.5" /> <Tr>Copiar</Tr>
            </SubmitButton>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground"><Tr>Ningún otro cliente tiene tarifas todavía.</Tr></p>
        )}
      </Form>
    </div>
  );

  return (
    <Panel
      title="Tarifas negociadas"
      description="Precios especiales de este cliente. Se aplican al facturar y al importar movimientos del WMS; lo que no esté aquí usa el tarifario estándar."
      action={
        quotes.length > 0 ? (
          <Form action={copyRatesFromQuote.bind(null, clientId)} className="flex items-center gap-2">
            <select name="quoteId" className="input h-8 w-auto text-xs" defaultValue={quotes[0].id} aria-label={t("Cotización")}>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.folio}
                </option>
              ))}
            </select>
            <SubmitButton className="btn-secondary h-8 text-xs" pendingText={t("Copiando…")}>
              <Copy className="size-3.5" /> <Tr>Copiar de cotización</Tr>
            </SubmitButton>
          </Form>
        ) : undefined
      }
    >
      {empty ? (
        <>
          <Empty icon={Tags}><Tr>Este cliente todavía no tiene tarifas negociadas; mientras tanto se usa el tarifario estándar. Cárgalas de una vez o agrégalas una por una.</Tr></Empty>
          <div className="border-t bg-muted/30">{quickLoad}</div>
        </>
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
                      {!r.active && <Badge variant="secondary"><Tr>Inactiva</Tr></Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {r.wmsConcept ? (
                        <>
                          WMS: <span className="text-foreground">{r.wmsConcept}</span>
                        </>
                      ) : (
                        <span className="text-amber-700"><Tr>Sin concepto del WMS: no se aplicará al importar</Tr></span>
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
                        <input type="checkbox" name="active" value="on" defaultChecked={r.active} /> <Tr>Activa</Tr>
                        <input type="hidden" name="active" value="off" />
                      </label>
                      <SubmitButton className="btn-primary"><Tr>Guardar tarifa</Tr></SubmitButton>
                    </div>
                  </Form>
                  <Form action={deleteRate.bind(null, r.id)} className="mt-2">
                    <ConfirmButton message={t("¿Eliminar la tarifa “{v0}”?", { v0: r.name })} className="btn-danger h-8 text-xs">
                      <Trash2 className="size-3.5" /> <Tr>Eliminar</Tr>
                    </ConfirmButton>
                  </Form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <details className="group border-t" open={empty}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-primary hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          <Plus className="size-4" /> <Tr>Agregar tarifa</Tr>
        </summary>
        <div className="border-t bg-muted/30 px-5 py-4">
          {!empty && quickLoad}
          <Form action={createRate.bind(null, clientId)} className="space-y-3">
            <RateFields services={services} wmsConcepts={wmsConcepts} />
            <div className="flex justify-end">
              <SubmitButton><Tr>Agregar tarifa</Tr></SubmitButton>
            </div>
          </Form>
        </div>
      </details>
    </Panel>
  );
}
