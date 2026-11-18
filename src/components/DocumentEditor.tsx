"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { computeLines, type LineInput } from "@/lib/totals";
import { formatMoney } from "@/lib/money";
import { UNITS } from "@/lib/constants";

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
  issueDate: string;
  secondDate: string;
  notes: string;
  terms?: string;
  // cotización
  attention?: string;
  profile?: ProfileRow[];
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
});

const lineAmount = (l: LineInput) =>
  l.atCost ? l.amount ?? 0 : l.quantity * l.unitPrice * (1 - (l.discountPct ?? 0) / 100);

export function DocumentEditor({
  action,
  clients,
  services,
  defaults,
  kind,
  defaultTaxRate,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: ClientOpt[];
  services: ServiceOpt[];
  defaults: DocumentDefaults;
  kind: "quote" | "invoice";
  defaultTaxRate: number;
  submitLabel: string;
}) {
  const isQuote = kind === "quote";
  const [lines, setLines] = useState<LineInput[]>(defaults.items.length ? defaults.items : [emptyLine(defaultTaxRate)]);
  const [profile, setProfile] = useState<ProfileRow[]>(defaults.profile ?? []);

  // En facturas solo cuentan los conceptos con cantidad (o importe al costo).
  const billable = (l: LineInput) => l.description.trim() && (isQuote || l.quantity > 0 || (l.atCost && (l.amount ?? 0) > 0));
  const kept = lines.filter(billable);
  const totals = useMemo(() => computeLines(kept), [kept]);

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
    <form action={action} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(kept)} />
      {isQuote && <input type="hidden" name="profile" value={JSON.stringify(profile.filter((r) => r.label.trim()))} />}
      {defaults.quoteId && <input type="hidden" name="quoteId" value={defaults.quoteId} />}

      <div className="card grid gap-4 p-5 md:grid-cols-3">
        <label className="block">
          <span className="label">Cliente</span>
          <select name="clientId" defaultValue={defaults.clientId ?? ""} required className="input">
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
            <span className="label">Atención</span>
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
              <p className="text-xs text-slate-500">El cliente se agrega solo. Las filas sin detalle no se imprimen.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setProfile((p) => [...p, { label: "", value: "" }])}>
              + Fila
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
                <button type="button" title="Quitar" className="px-2 text-rose-400 hover:text-rose-700" onClick={() => setProfile((p) => p.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="font-semibold">{isQuote ? "Servicios y tarifas" : "Detalle de servicios facturados"}</h2>
            <p className="text-xs text-slate-500">
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
              + Concepto libre
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {lines.map((l, i) => (
            <div key={i} className={`space-y-2 px-5 py-4 ${isQuote && l.quantity === 0 ? "bg-slate-50/60" : ""}`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_90px_130px_80px_80px_120px_auto]">
                <Cell label="Concepto" className="col-span-2 sm:col-span-4 2xl:col-span-1">
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
                  <button type="button" title="Subir" className="px-1 text-slate-400 hover:text-slate-700" onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" title="Bajar" className="px-1 text-slate-400 hover:text-slate-700" onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button type="button" title="Eliminar" className="px-1 text-rose-400 hover:text-rose-700" onClick={() => remove(i)}>
                    ✕
                  </button>
                </div>
              </div>
              <div className={`grid grid-cols-2 gap-2 ${isQuote ? "sm:grid-cols-4 2xl:grid-cols-[100px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,3fr)_auto]" : "sm:grid-cols-[100px_minmax(0,1fr)_auto]"}`}>
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
                  <Cell label="Descripción" className="col-span-2 sm:col-span-4 2xl:col-span-1">
                    <textarea rows={1} className="input min-h-[38px] text-xs" value={l.detail ?? ""} onChange={(e) => update(i, { detail: e.target.value })} />
                  </Cell>
                )}
                <label className="flex items-end gap-2 pb-2.5 text-xs text-slate-600">
                  <input type="checkbox" checked={Boolean(l.atCost)} onChange={(e) => update(i, { atCost: e.target.checked })} /> Al costo
                </label>
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

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <dl className="w-full max-w-xs space-y-1 text-sm">
            {isQuote && <div className="label">Costo mensual estimado</div>}
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal sin IVA</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Descuento</dt>
                <dd className="tabular-nums">−{formatMoney(totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">IVA</dt>
              <dd className="tabular-nums">{formatMoney(totals.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-semibold">
              <dt>{isQuote ? "Total estimado" : "Total a pagar"}</dt>
              <dd className="tabular-nums text-accent">{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

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
    </form>
  );
}

function Cell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className ?? ""}`}>
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
