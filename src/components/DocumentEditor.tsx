"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { computeLines, type LineInput } from "@/lib/totals";
import { formatMoney } from "@/lib/money";
import { UNITS } from "@/lib/constants";

type ClientOpt = { id: number; name: string };
type ServiceOpt = { id: number; code: string; name: string; description: string; unit: string; unitPrice: number; taxRate: number };

export type DocumentDefaults = {
  clientId?: number;
  issueDate: string;
  secondDate: string;
  notes: string;
  terms?: string;
  items: LineInput[];
};

const emptyLine = (taxRate: number): LineInput => ({
  code: "",
  description: "",
  unit: "Servicio",
  quantity: 1,
  unitPrice: 0,
  discountPct: 0,
  taxRate,
});

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
  const [lines, setLines] = useState<LineInput[]>(defaults.items.length ? defaults.items : [emptyLine(defaultTaxRate)]);
  const totals = useMemo(() => computeLines(lines.filter((l) => l.description.trim())), [lines]);

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
  const addService = (id: string) => {
    const s = services.find((x) => String(x.id) === id);
    if (!s) return;
    const line: LineInput = {
      code: s.code,
      description: s.description ? `${s.name} — ${s.description}` : s.name,
      unit: s.unit,
      quantity: 1,
      unitPrice: s.unitPrice,
      discountPct: 0,
      taxRate: s.taxRate,
    };
    setLines((ls) => {
      const onlyEmpty = ls.length === 1 && !ls[0].description.trim();
      return onlyEmpty ? [line] : [...ls, line];
    });
  };

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="items" value={JSON.stringify(lines.filter((l) => l.description.trim()))} />

      <div className="card grid gap-4 p-5 md:grid-cols-3">
        <label className="block md:col-span-1">
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
          <span className="label">{kind === "quote" ? "Vigente hasta" : "Fecha de vencimiento"}</span>
          <input type="date" name="secondDate" defaultValue={defaults.secondDate} required className="input" />
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold">Conceptos</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="input w-auto"
              value=""
              onChange={(e) => {
                addService(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="">+ Agregar del catálogo…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name} ({formatMoney(s.unitPrice)}/{s.unit})
                </option>
              ))}
            </select>
            <button type="button" className="btn-secondary" onClick={() => setLines((ls) => [...ls, emptyLine(defaultTaxRate)])}>
              + Concepto libre
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[1050px] [&_td]:px-2 [&_th]:px-2">
            <thead>
              <tr>
                <th className="w-24">Clave</th>
                <th className="min-w-[300px]">Descripción</th>
                <th className="w-28">Unidad</th>
                <th className="w-24 text-right">Cant.</th>
                <th className="w-32 text-right">P. Unitario</th>
                <th className="w-20 text-right">Desc. %</th>
                <th className="w-20 text-right">IVA %</th>
                <th className="w-32 text-right">Importe</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const amount = l.quantity * l.unitPrice * (1 - (l.discountPct ?? 0) / 100);
                return (
                  <tr key={i} className="align-top">
                    <td>
                      <input className="input" value={l.code ?? ""} onChange={(e) => update(i, { code: e.target.value })} />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        className="input min-h-[38px] min-w-[280px]"
                        placeholder="Descripción del servicio"
                        value={l.description}
                        onChange={(e) => update(i, { description: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        list="units"
                        value={l.unit ?? ""}
                        onChange={(e) => update(i, { unit: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="input text-right"
                        value={l.quantity}
                        onChange={(e) => update(i, { quantity: num(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input text-right"
                        value={l.unitPrice}
                        onChange={(e) => update(i, { unitPrice: num(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="100"
                        className="input text-right"
                        value={l.discountPct ?? 0}
                        onChange={(e) => update(i, { discountPct: num(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="input text-right"
                        value={l.taxRate ?? 0}
                        onChange={(e) => update(i, { taxRate: num(e.target.value) })}
                      />
                    </td>
                    <td className="pt-5 text-right tabular-nums">{formatMoney(amount)}</td>
                    <td className="whitespace-nowrap pt-4 text-right">
                      <button type="button" title="Subir" className="px-1 text-slate-400 hover:text-slate-700" onClick={() => move(i, -1)}>
                        ↑
                      </button>
                      <button type="button" title="Bajar" className="px-1 text-slate-400 hover:text-slate-700" onClick={() => move(i, 1)}>
                        ↓
                      </button>
                      <button type="button" title="Eliminar" className="px-1 text-rose-400 hover:text-rose-700" onClick={() => remove(i)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
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
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className={`card grid gap-4 p-5 ${kind === "quote" ? "md:grid-cols-2" : ""}`}>
        <label className="block">
          <span className="label">Notas (aparecen en el PDF)</span>
          <textarea name="notes" rows={4} defaultValue={defaults.notes} className="input" />
        </label>
        {kind === "quote" && (
          <label className="block">
            <span className="label">Términos y condiciones</span>
            <textarea name="terms" rows={4} defaultValue={defaults.terms} className="input" />
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
