"use client";

import { useState } from "react";
import type { ClientRate } from "@prisma/client";
import { UNITS } from "@/lib/constants";
import { Field } from "./kit";
import { Tr } from "@/components/Tr";
import { useT } from "@/components/I18nProvider";

export type ServicePick = {
  id: number;
  code: string;
  name: string;
  description: string;
  unit: string;
  unitPrice: number;
  priceText: string;
  atCost: boolean;
  taxRate: number;
  wmsConcept: string;
  section: string;
};

/** Campos de una tarifa del cliente. Al dar de alta permite partir de un servicio del tarifario. */
export function RateFields({ rate, services, wmsConcepts }: { rate?: ClientRate; services?: ServicePick[]; wmsConcepts: string[] }) {
  const t = useT();
  const [v, setV] = useState({
    code: rate?.code ?? "",
    name: rate?.name ?? "",
    description: rate?.description ?? "",
    wmsConcept: rate?.wmsConcept ?? "",
    unit: rate?.unit ?? "Orden",
    unitPrice: rate?.unitPrice ?? 0,
    priceText: rate?.priceText ?? "",
    atCost: rate?.atCost ?? false,
    taxRate: rate?.taxRate ?? 16,
  });
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const listId = `wms-concepts-${rate?.id ?? "new"}`;

  return (
    <div className="space-y-3">
      {services && (
        <Field label="Partir de un servicio del tarifario (opcional)">
          <select
            className="input"
            defaultValue=""
            onChange={(e) => {
              const s = services.find((x) => String(x.id) === e.target.value);
              if (s)
                set({
                  code: s.code,
                  name: s.name,
                  description: s.description,
                  unit: s.unit,
                  unitPrice: s.unitPrice,
                  priceText: s.priceText,
                  atCost: s.atCost,
                  taxRate: s.taxRate,
                  wmsConcept: s.wmsConcept || v.wmsConcept,
                });
            }}
          >
            <option value="">{t("— Elegir —")}</option>
            {[...new Set(services.map((s) => s.section))].map((sec) => (
              <optgroup key={sec} label={sec || t("Otros")}>
                {services
                  .filter((s) => s.section === sec)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field label="Nombre en la factura *">
          <input name="name" required className="input" value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder={t("Orden Ligera (hasta 2 SKUs)")} />
        </Field>
        <Field label="Clave">
          <input name="code" className="input uppercase" value={v.code} onChange={(e) => set({ code: e.target.value })} />
        </Field>
      </div>
      <Field label="Concepto en el WMS" hint="Cómo aparece en el estado de cobro del WMS. Si son varios, sepáralos con punto y coma.">
        <input name="wmsConcept" list={listId} className="input" value={v.wmsConcept} onChange={(e) => set({ wmsConcept: e.target.value })} placeholder={t("Procesamiento de pedido")} />
        <datalist id={listId}>
          {wmsConcepts.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Precio (sin IVA)">
          <input name="unitPrice" type="number" step="0.01" min="0" disabled={v.atCost} className="input text-right" value={v.unitPrice} onChange={(e) => set({ unitPrice: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Unidad">
          <input name="unit" list="rate-units" className="input" value={v.unit} onChange={(e) => set({ unit: e.target.value })} />
        </Field>
        <Field label="IVA %">
          <input name="taxRate" type="number" step="any" min="0" className="input text-right" value={v.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Tarifa en texto">
          <input name="priceText" className="input" value={v.priceText} onChange={(e) => set({ priceText: e.target.value })} placeholder={t("Opcional")} />
        </Field>
      </div>
      <Field label="Descripción (opcional)">
        <input name="description" className="input" value={v.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="atCost" checked={v.atCost} onChange={(e) => set({ atCost: e.target.checked })} /> <Tr>Al costo: se factura el importe que reporta el WMS (ej. fletes)</Tr>
      </label>
      {v.atCost && <input type="hidden" name="unitPrice" value={0} />}
      <datalist id="rate-units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}
