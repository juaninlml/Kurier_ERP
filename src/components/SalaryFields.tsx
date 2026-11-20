"use client";

import { useState } from "react";
import { salaryRates } from "@/lib/payroll";
import { formatMoney } from "@/lib/money";
import { Tr } from "@/components/Tr";
import { useT } from "@/components/I18nProvider";

/** Salario semanal + jornada, con el desglose a diario y por hora mientras se escribe. */
export function SalaryFields({ weekly, workDays, hoursPerDay, weeklyBonus }: { weekly?: number; workDays?: number; hoursPerDay?: number; weeklyBonus?: number }) {
  const t = useT();
  const [w, setW] = useState(weekly ?? 0);
  const [d, setD] = useState(workDays === 5 ? 5 : 6);
  const [h, setH] = useState(hoursPerDay ?? 8);
  const r = salaryRates(w, d, h);
  return (
    <>
      <label className="block">
        <span className="label"><Tr>Salario semanal *</Tr></span>
        <input name="weeklySalary" type="number" step="0.01" min="0" required value={w || ""} onChange={(e) => setW(Number(e.target.value) || 0)} className="input text-right" />
      </label>
      <label className="block">
        <span className="label"><Tr>Jornada</Tr></span>
        <select name="workDays" value={d} onChange={(e) => setD(Number(e.target.value))} className="input">
          <option value={6}>{t("6 días (descansa domingo)")}</option>
          <option value={5}>{t("5 días (descansa fin de semana)")}</option>
        </select>
      </label>
      <label className="block">
        <span className="label"><Tr>Horas por día</Tr></span>
        <input name="hoursPerDay" type="number" step="0.5" min="1" max="24" value={h} onChange={(e) => setH(Number(e.target.value) || 8)} className="input text-right" />
      </label>
      <label className="block">
        <span className="label"><Tr>Bono fijo semanal</Tr></span>
        <input name="weeklyBonus" type="number" step="0.01" min="0" defaultValue={weeklyBonus ?? 0} className="input text-right" />
        <span className="mt-1 block text-xs text-muted-foreground"><Tr>Puntualidad, asistencia… (opcional)</Tr></span>
      </label>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-center text-sm md:col-span-3">
        {(
          [
            [t("Semanal"), r.weekly],
            [t("Diario (÷ {v0})", { v0: r.workDays }), r.daily],
            [t("Por hora (÷ {v0} h)", { v0: h }), r.hourly],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <div className="text-[11px] text-muted-foreground">{k}</div>
            <div className="font-semibold tabular-nums">{formatMoney(v)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
