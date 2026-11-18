"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { computeLines, type LineInput } from "@/lib/totals";
import { formatMoney } from "@/lib/money";
import { UNITS } from "@/lib/constants";
import { Form } from "./Form";
import { parseVolumes, scenarioTable, type PerOrderRow } from "@/lib/quote-extras";

const SCALING_UNITS = ["orden", "pedido", "guía", "guia", "pieza", "envío", "envio"];

type ClientOpt = { id: number; name: string };
export type ServiceOpt = {
  id: number;
  code: string;
  name: string;
  description: string;
  unit: string;
  unitPrice: number;
  taxRate: number;
  section: string;
  priceText: string;
  atCost: boolean;
};
export type ProfileRow = { label: string; value: string };

export type DocumentDefaults = {
  clientId?: number;
  quoteId?: number;
  /** Estado de cobro del WMS del que sale esta factura. */
  importId?: number;
  issueDate: string;
  secondDate: string;
  notes: string;
  terms?: string;
  // cotización
  attention?: string;
  /** Cotización para un prospecto (todavía no es cliente). */
  prospect?: { name: string; legalName: string; rfc: string; email: string; phone: string };
  profile?: ProfileRow[];
  perOrder?: PerOrderRow[];
  perOrderFee?: number;
  baseVolume?: number;
  scenarios?: string;
  // factura
  period?: string;
  volume?: string;
  storage?: string;
  items: LineInput[];
};

const emptyLine = (taxRate: number): LineInput => ({
  code: "",
  description: "",
  detail: "",
  section: "",
  priceText: "",
  unit: "Servicio",
  quantity: 1,
  unitPrice: 0,
  discountPct: 0,
  taxRate,
  atCost: false,
  amount: 0,
});

const fromService = (s: ServiceOpt, quantity: number): LineInput => ({
  code: s.code,
  description: s.name,
  detail: s.description,
  section: s.section,
  priceText: s.priceText,
  unit: s.unit,
  quantity,
  unitPrice: s.unitPrice,
  discountPct: 0,
  taxRate: s.taxRate,
  atCost: s.atCost,
  amount: 0,
  // Lo que se cobra por pedido/guía/pieza crece con el volumen en los escenarios.
  scales: SCALING_UNITS.includes(s.unit.trim().toLowerCase()),
});

const lineAmount = (l: LineInput) =>
  l.atCost ? l.amount ?? 0 : l.quantity * l.unitPrice * (1 - (l.discountPct ?? 0) / 100);

export function DocumentEditor({
  action,
  clients,
  services: catalog,
  clientRates = {},
  defaults,
  kind,
  defaultTaxRate,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<unknown>;
  clients: ClientOpt[];
  services: ServiceOpt[];
  /** Tarifas negociadas por cliente; aparecen primero en el selector de servicios. */
  clientRates?: Record<number, ServiceOpt[]>;
  defaults: DocumentDefaults;
  kind: "quote" | "invoice";
  defaultTaxRate: number;
  submitLabel: string;
}) {
  const isQuote = kind === "quote";
  const [clientId, setClientId] = useState<number | undefined>(defaults.clientId);
  // En cotizaciones: propuesta a un prospecto (por defecto) o a un cliente actual (renegociación)
  const [partyType, setPartyType] = useState<"prospect" | "client">(isQuote && !defaults.clientId ? "prospect" : "client");
  const forProspect = isQuote && partyType === "prospect";
  const effectiveClientId = forProspect ? undefined : clientId;
  const ownRates = (effectiveClientId && clientRates[effectiveClientId]) || [];
  const services = useMemo(() => [...ownRates, ...catalog], [ownRates, catalog]);
  const [lines, setLines] = useState<LineInput[]>(defaults.items.length ? defaults.items : [emptyLine(defaultTaxRate)]);
  const [profile, setProfile] = useState<ProfileRow[]>(defaults.profile ?? []);

  // En facturas solo cuentan los conceptos con cantidad (o importe al costo).
  const billable = (l: LineInput) => l.description.trim() && (isQuote || l.quantity > 0 || (l.atCost && (l.amount ?? 0) > 0));
  const kept = lines.filter(billable);
  const totals = useMemo(() => computeLines(kept), [kept]);

  // Cotización: tablas "Costo por pedido" y "Costo mensual según volumen"
  const [perOrder, setPerOrder] = useState<PerOrderRow[]>(defaults.perOrder ?? []);
  const [perOrderFee, setPerOrderFee] = useState(defaults.perOrderFee ?? 0);
  const [baseVolume, setBaseVolume] = useState(defaults.baseVolume ?? 0);
  const [scenarios, setScenarios] = useState(defaults.scenarios ?? "");
  const volumes = parseVolumes(scenarios);
  const scenarioPreview = isQuote ? scenarioTable(kept, baseVolume, volumes, formatMoney) : null;

  const sections = useMemo(() => {
    const map = new Map<string, ServiceOpt[]>();
    for (const s of services) map.set(s.section || "Otros", [...(map.get(s.section || "Otros") ?? []), s]);
    return [...map.entries()];
  }, [services]);

  const update = (i: number, patch: Partial<LineInput>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((ls) => (ls.length === 1 ? [emptyLine(defaultTaxRate)] : ls.filter((_, idx) => idx !== i)));
  const move = (i: number, dir: -1 | 1) =>
    setLines((ls) => {
      const j = i + dir;
      if (j < 0 || j >= ls.length) return ls;
      const copy = [...ls];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const append = (newLines: LineInput[]) =>
    setLines((ls) => {
      const onlyEmpty = ls.length === 1 && !ls[0].description.trim();
      return onlyEmpty ? newLines : [...ls, ...newLines];
    });
  const addService = (id: string) => {
    const s = services.find((x) => String(x.id) === id);
    if (s) append([fromService(s, isQuote ? 0 : 1)]);
  };
  const addSection = (name: string) => {
    const list = sections.find(([n]) => n === name)?.[1] ?? [];
    append(list.map((s) => fromService(s, 0)));
  };

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <Form action={action} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(kept)} />
      {isQuote && <input type="hidden" name="profile" value={JSON.stringify(profile.filter((r) => r.label.trim()))} />}
      {isQuote && <input type="hidden" name="perOrder" value={JSON.stringify(perOrder.filter((r) => r.label.trim()))} />}
      {defaults.quoteId && <input type="hidden" name="quoteId" value={defaults.quoteId} />}
      {defaults.importId && <input type="hidden" name="importId" value={defaults.importId} />}

      <div className="card grid gap-4 p-5 md:grid-cols-3">
        {isQuote && (
          <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-3">
            <input type="hidden" name="partyType" value={partyType} />
            <div className="inline-flex rounded-lg bg-muted p-1" role="radiogroup" aria-label="Destinatario de la propuesta">
              {(
                [
                  ["prospect", "Prospecto nuevo"],
                  ["client", "Cliente actual"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={partyType === v}
                  onClick={() => setPartyType(v)}
                  className={`h-8 rounded-md px-3 text-sm transition-colors ${partyType === v ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {forProspect
                ? "Al aceptarse la propuesta se da de alta el cliente con estos datos y sus tarifas."
                : "Renegociación: al aceptarse, las tarifas se actualizan en las tarifas negociadas del cliente."}
            </p>
          </div>
        )}
        {forProspect ? (
          <>
            <label className="block md:col-span-1">
              <span className="label">Prospecto (empresa o marca) *</span>
              <input name="prospectName" required defaultValue={defaults.prospect?.name} placeholder="Cestco Dental" className="input" />
            </label>
            <label className="block">
              <span className="label">Razón social</span>
              <input name="prospectLegalName" defaultValue={defaults.prospect?.legalName} className="input" />
            </label>
            <label className="block">
              <span className="label">RFC</span>
              <input name="prospectRfc" defaultValue={defaults.prospect?.rfc} className="input uppercase" />
            </label>
            <label className="block">
              <span className="label">Correo</span>
              <input name="prospectEmail" type="email" defaultValue={defaults.prospect?.email} className="input" />
            </label>
            <label className="block">
              <span className="label">Teléfono</span>
              <input name="prospectPhone" defaultValue={defaults.prospect?.phone} className="input" />
            </label>
            <div className="hidden md:block" />
          </>
        ) : (
        <label className="block">
          <span className="label">Cliente</span>
          <select name="clientId" defaultValue={defaults.clientId ?? ""} required className="input" onChange={(e) => setClientId(Number(e.target.value) || undefined)}>
            <option value="" disabled>
              Selecciona un cliente…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        )}
        <label className="block">
          <span className="label">Fecha de emisión</span>
          <input type="date" name="issueDate" defaultValue={defaults.issueDate} required className="input" />
        </label>
        <label className="block">
          <span className="label">{isQuote ? "Vigente hasta" : "Fecha de vencimiento"}</span>
          <input type="date" name="secondDate" defaultValue={defaults.secondDate} required className="input" />
        </label>

        {isQuote ? (
          <label className="block md:col-span-3">
            <span className="label">{forProspect ? "Contacto (atención)" : "Atención"}</span>
            <input name="attention" defaultValue={defaults.attention} placeholder="Nombre del contacto (o “Por confirmar”)" className="input" />
          </label>
        ) : (
          <>
            <label className="block md:col-span-2">
              <span className="label">Periodo facturado</span>
              <input name="period" defaultValue={defaults.period} placeholder="15 al 22 de agosto de 2026 — ciclo semanal" className="input" />
            </label>
            <label className="block">
              <span className="label">Condiciones de pago</span>
              <input name="terms" defaultValue={defaults.terms} className="input" />
            </label>
            <label className="block md:col-span-2">
              <span className="label">Volumen del periodo</span>
              <input name="volume" defaultValue={defaults.volume} placeholder="39 pedidos, todos bajo la tarifa Orden Ligera negociada." className="input" />
            </label>
            <label className="block">
              <span className="label">Almacenamiento</span>
              <input name="storage" defaultValue={defaults.storage} placeholder="No se cobra en este periodo." className="input" />
            </label>
          </>
        )}
      </div>

      {isQuote && (
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Perfil de la operación cotizada</h2>
              <p className="text-xs text-muted-foreground">El cliente se agrega solo. Las filas sin detalle no se imprimen.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setProfile((p) => [...p, { label: "", value: "" }])}>
              <Plus className="size-4" /> Fila
            </button>
          </div>
          <div className="space-y-2">
            {profile.map((r, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
                <input
                  className="input font-medium"
                  placeholder="Concepto"
                  value={r.label}
                  onChange={(e) => setProfile((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className="input"
                  placeholder="Detalle"
                  value={r.value}
                  onChange={(e) => setProfile((p) => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <button type="button" title="Quitar" aria-label="Quitar" className="inline-grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" onClick={() => setProfile((p) => p.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 className="font-semibold">{isQuote ? "Servicios y tarifas" : "Detalle de servicios facturados"}</h2>
            <p className="text-xs text-muted-foreground">
              {isQuote
                ? "Cantidad 0 = solo se muestra la tarifa. Con cantidad, el concepto entra al costo mensual estimado."
                : "Los conceptos con cantidad 0 no se facturan."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isQuote && (
              <select
                className="input w-auto"
                value=""
                onChange={(e) => {
                  addSection(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">+ Sección completa…</option>
                {sections.map(([name, list]) => (
                  <option key={name} value={name}>
                    {name} ({list.length})
                  </option>
                ))}
              </select>
            )}
            <select
              className="input w-auto max-w-xs"
              value=""
              onChange={(e) => {
                addService(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">+ Servicio del tarifario…</option>
              {sections.map(([name, list]) => (
                <optgroup key={name} label={name}>
                  {list.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.priceText || (s.atCost ? "Al costo" : formatMoney(s.unitPrice))}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" className="btn-secondary" onClick={() => append([emptyLine(defaultTaxRate)])}>
              <Plus className="size-4" /> Concepto libre
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {lines.map((l, i) => (
            <div key={i} className={`space-y-2 px-5 py-4 ${isQuote && l.quantity === 0 ? "bg-muted/40" : ""}`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_90px_130px_80px_80px_120px_auto]">
                <Cell label="Concepto" className="col-span-2 sm:col-span-4 xl:col-span-1">
                  <input className="input font-medium" value={l.description} placeholder="Nombre del servicio" onChange={(e) => update(i, { description: e.target.value })} />
                </Cell>
                <Cell label="Unidad">
                  <input className="input" list="units" value={l.unit ?? ""} onChange={(e) => update(i, { unit: e.target.value })} />
                </Cell>
                <Cell label="Cant.">
                  <input type="number" step="any" min="0" className="input text-right" value={l.quantity} onChange={(e) => update(i, { quantity: num(e.target.value) })} />
                </Cell>
                {l.atCost ? (
                  <Cell label="Importe al costo">
                    <input type="number" step="0.01" min="0" className="input text-right" value={l.amount ?? 0} onChange={(e) => update(i, { amount: num(e.target.value) })} />
                  </Cell>
                ) : (
                  <Cell label="P. unitario">
                    <input type="number" step="0.01" min="0" className="input text-right" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: num(e.target.value) })} />
                  </Cell>
                )}
                <Cell label="Desc. %">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    disabled={l.atCost}
                    className="input text-right"
                    value={l.discountPct ?? 0}
                    onChange={(e) => update(i, { discountPct: num(e.target.value) })}
                  />
                </Cell>
                <Cell label="IVA %">
                  <input type="number" step="any" min="0" className="input text-right" value={l.taxRate ?? 0} onChange={(e) => update(i, { taxRate: num(e.target.value) })} />
                </Cell>
                <Cell label="Importe">
                  <div className="py-2 text-right text-sm font-medium tabular-nums">{formatMoney(lineAmount(l))}</div>
                </Cell>
                <div className="flex items-end justify-end gap-1 pb-2">
                  <button type="button" title="Subir" aria-label="Subir" className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => move(i, -1)}>
                    <ChevronUp className="size-4" />
                  </button>
                  <button type="button" title="Bajar" aria-label="Bajar" className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => move(i, 1)}>
                    <ChevronDown className="size-4" />
                  </button>
                  <button type="button" title="Eliminar" aria-label="Eliminar" className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(i)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className={`grid grid-cols-2 gap-2 ${isQuote ? "sm:grid-cols-4 xl:grid-cols-[100px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,3fr)_auto]" : "sm:grid-cols-[100px_minmax(0,1fr)_auto]"}`}>
                <Cell label="Clave">
                  <input className="input text-xs" value={l.code ?? ""} onChange={(e) => update(i, { code: e.target.value })} />
                </Cell>
                {isQuote && (
                  <Cell label="Sección">
                    <input className="input text-xs" list="sections" value={l.section ?? ""} onChange={(e) => update(i, { section: e.target.value })} />
                  </Cell>
                )}
                <Cell label={isQuote ? "Tarifa (texto opcional)" : "Precio unitario (texto opcional)"}>
                  <input
                    className="input text-xs"
                    placeholder={l.atCost ? "Variable (al costo)" : isQuote ? "Ej. Sin costo, A cotización" : ""}
                    value={l.priceText ?? ""}
                    onChange={(e) => update(i, { priceText: e.target.value })}
                  />
                </Cell>
                {isQuote && (
                  <Cell label="Descripción" className="col-span-2 sm:col-span-4 xl:col-span-1">
                    <textarea rows={1} className="input min-h-[38px] text-xs" value={l.detail ?? ""} onChange={(e) => update(i, { detail: e.target.value })} />
                  </Cell>
                )}
                <div className="flex flex-col justify-end gap-1 pb-1.5 text-xs text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(l.atCost)} onChange={(e) => update(i, { atCost: e.target.checked })} /> Al costo
                  </label>
                  {isQuote && (
                    <label className="flex items-center gap-2 whitespace-nowrap" title="En los escenarios por volumen, la cantidad crece en proporción a los pedidos">
                      <input type="checkbox" checked={Boolean(l.scales)} onChange={(e) => update(i, { scales: e.target.checked })} /> Escala con volumen
                    </label>
                  )}
                </div>
              </div>
            </div>
          ))}
          <datalist id="units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <datalist id="sections">
            {sections.map(([n]) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        <div className="flex justify-end border-t border-border bg-muted px-5 py-4">
          <dl className="w-full max-w-xs space-y-1 text-sm">
            {isQuote && <div className="label">Costo mensual estimado</div>}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal sin IVA</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Descuento</dt>
                <dd className="tabular-nums">−{formatMoney(totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">IVA</dt>
              <dd className="tabular-nums">{formatMoney(totals.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>{isQuote ? "Total estimado" : "Total a pagar"}</dt>
              <dd className="tabular-nums text-kurier">{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {isQuote && (
        <div className="card grid gap-6 p-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Costo por pedido</h2>
                <p className="text-xs text-muted-foreground">Opcional. Combinaciones típicas de pedido y su costo de fulfillment.</p>
              </div>
              <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setPerOrder((p) => [...p, { label: "", amount: 0 }])}>
                <Plus className="size-4" /> Fila
              </button>
            </div>
            <div className="space-y-2">
              {perOrder.map((r, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2">
                  <input
                    className="input"
                    placeholder="1 a 2 piezas, bolsa estándar"
                    value={r.label}
                    onChange={(e) => setPerOrder((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input text-right"
                    value={r.amount}
                    onChange={(e) => setPerOrder((p) => p.map((x, j) => (j === i ? { ...x, amount: num(e.target.value) } : x)))}
                  />
                  <button type="button" title="Quitar" aria-label="Quitar" className="inline-grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" onClick={() => setPerOrder((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="label">Comisión de guía para la columna “Con guía de Kurier” (0 = no se muestra)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="perOrderFee"
                className="input w-40 text-right"
                value={perOrderFee}
                onChange={(e) => setPerOrderFee(num(e.target.value))}
              />
            </label>
          </div>

          <div>
            <h2 className="font-semibold">Costo mensual según volumen</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Opcional. Recalcula el costo estimado para varios volúmenes. Los conceptos con “Escala con volumen” crecen en proporción; los demás
              (ej. sistema) quedan fijos.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Pedidos del costo estimado</span>
                <input type="number" min="0" step="1" name="baseVolume" className="input text-right" value={baseVolume} onChange={(e) => setBaseVolume(num(e.target.value))} />
              </label>
              <label className="block">
                <span className="label">Volúmenes a comparar</span>
                <input name="scenarios" className="input" placeholder="250, 500, 1000" value={scenarios} onChange={(e) => setScenarios(e.target.value)} />
              </label>
            </div>
            {scenarioPreview ? (
              <div className="mt-3 overflow-x-auto">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      {volumes.map((v) => (
                        <th key={v} className="text-right">
                          {v.toLocaleString("es-MX")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioPreview.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.label}</td>
                        {r.values.map((v, j) => (
                          <td key={j} className="text-right tabular-nums">
                            {formatMoney(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td>Total con IVA</td>
                      {scenarioPreview.total.map((v, j) => (
                        <td key={j} className="text-right tabular-nums text-kurier">
                          {formatMoney(v)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              (baseVolume > 0 || volumes.length > 0) && (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Para ver los escenarios indica los pedidos del estimado, los volúmenes y al menos un concepto con cantidad.
                </p>
              )
            )}
          </div>
        </div>
      )}

      <div className={`card grid gap-4 p-5 ${isQuote ? "md:grid-cols-2" : ""}`}>
        <label className="block">
          <span className="label">{isQuote ? "Nota del costo estimado (aparece en el PDF)" : "Nota bajo el detalle (aparece en el PDF)"}</span>
          <textarea name="notes" rows={4} defaultValue={defaults.notes} className="input" />
        </label>
        {isQuote && (
          <label className="block">
            <span className="label">Condiciones comerciales (una por línea; “Título: texto”)</span>
            <textarea name="terms" rows={8} defaultValue={defaults.terms} className="input" />
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </Form>
  );
}

function Cell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className ?? ""}`}>
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
