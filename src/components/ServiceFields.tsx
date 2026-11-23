import type { Service } from "@prisma/client";
import { Field } from "./kit";
import { UNITS } from "@/lib/constants";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

import { NumberField } from "./NumberField";
/** Campos del formulario de servicio (alta y edición). */
export async function ServiceFields({ sv, sections, defaultTaxRate }: { sv?: Service; sections: string[]; defaultTaxRate: number }) {
  const t = await getT();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Clave *">
          <input name="code" required defaultValue={sv?.code} className="input uppercase" placeholder="FUL-08" />
        </Field>
        <Field label="Sección del tarifario">
          <input name="section" list="sections-list" defaultValue={sv?.section} className="input" placeholder={t("Fulfillment (pick & pack)")} />
        </Field>
      </div>
      <Field label="Servicio *">
        <input name="name" required defaultValue={sv?.name} className="input" placeholder={t("Orden Estándar +")} />
      </Field>
      <Field label="Descripción (aparece en la cotización)">
        <textarea name="description" rows={3} defaultValue={sv?.description} className="input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio unitario (sin IVA)">
          <NumberField name="unitPrice" defaultValue={sv?.unitPrice} className="input text-right" />
        </Field>
        <Field label="Unidad de cobro">
          <input name="unit" list="units-list" defaultValue={sv?.unit ?? "Orden"} className="input" />
        </Field>
        <Field label="Tarifa en texto (opcional)">
          <input name="priceText" defaultValue={sv?.priceText} className="input" placeholder={t("Sin costo · A cotizar · $110 + $15 / kg")} />
        </Field>
        <Field label="IVA %">
          <input name="taxRate" type="number" step="any" min="0" defaultValue={sv?.taxRate ?? defaultTaxRate} className="input" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="atCost" defaultChecked={sv?.atCost} /> <Tr>Se factura al costo (el importe se captura en cada factura, ej. guías de envío)</Tr>
      </label>
      <datalist id="units-list">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id="sections-list">
        {sections.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}
