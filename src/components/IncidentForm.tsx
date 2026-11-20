"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { useT } from "./I18nProvider";

/** Alta de una falta injustificada, un permiso (falta justificada) o vacaciones. */
export function IncidentForm({ action, today }: { action: (fd: FormData) => Promise<unknown>; today: string }) {
  const t = useT();
  const [type, setType] = useState("VACACIONES");
  const [from, setFrom] = useState(today);
  const request = type !== "FALTA";

  return (
    <Form action={action} resetOnSuccess className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_150px_150px_minmax(0,1.6fr)]">
      <label className="block">
        <span className="label">{t("Tipo")}</span>
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
          <option value="VACACIONES">{t("Vacaciones")}</option>
          <option value="PERMISO">{t("Permiso / falta justificada")}</option>
          <option value="FALTA">{t("Falta injustificada")}</option>
        </select>
      </label>
      <label className="block">
        <span className="label">{t("Del")}</span>
        <input type="date" name="startDate" required value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
      </label>
      <label className="block">
        <span className="label">{t("Al")}</span>
        <input type="date" name="endDate" min={from} className="input" aria-describedby="incident-end-hint" />
        <span id="incident-end-hint" className="mt-1 block text-[11px] text-muted-foreground">
          {t("Vacío = un solo día")}
        </span>
      </label>
      <label className="block">
        <span className="label">{type === "PERMISO" ? t("Motivo (obligatorio)") : t("Motivo / observaciones")}</span>
        <input
          name="reason"
          required={type === "PERMISO"}
          className="input"
          placeholder={type === "PERMISO" ? t("Ej. cita médica, trámite, incapacidad") : type === "FALTA" ? t("Ej. no avisó") : t("Opcional")}
        />
      </label>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-4">
        {type === "PERMISO" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="withPay" /> {t("Con goce de sueldo")}
          </label>
        )}
        {request && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="authorize" defaultChecked /> {t("Autorizar ahora")}
          </label>
        )}
        <span className="text-xs text-muted-foreground">
          {type === "VACACIONES"
            ? t("Se cuentan solo sus días laborables y se pagan con prima vacacional del 25% en la nómina de esa semana.")
            : type === "PERMISO"
              ? t("Sin goce: no se pagan esos días, pero no cuenta como falta injustificada ni afecta el aguinaldo.")
              : t("Se descuenta a salario diario y resta días del aguinaldo.")}
        </span>
        <SubmitButton className="btn-primary ml-auto" pendingText={t("Guardando…")}>
          <CalendarPlus className="size-4" /> {t("Registrar")}
        </SubmitButton>
      </div>
    </Form>
  );
}
