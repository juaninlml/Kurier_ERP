"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import Link from "next/link";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { payrollLine } from "@/lib/payroll";
import { formatMoney } from "@/lib/money";

export type EditorLine = {
  id: number;
  employeeId: number;
  name: string;
  position: string;
  dailySalary: number;
  days: number;
  absences: number;
  vacationDays: number;
  overtime: number;
  bonus: number;
  aguinaldo: number;
  otherIncome: number;
  deductions: number;
  notes: string;
  /** Vacaciones disponibles sin contar esta nómina. */
  vacationAvailable: number;
  /** Aguinaldo proporcional al día de pago. */
  aguinaldoDue: number;
};

const NUM: { key: keyof EditorLine; label: string; title: string; money?: boolean }[] = [
  { key: "days", label: "Días", title: "Días pagados (incluye séptimo día)" },
  { key: "absences", label: "Faltas", title: "Días de falta: se descuentan" },
  { key: "vacationDays", label: "Vac.", title: "Días de vacaciones tomados: se pagan dentro de los días + 25% de prima vacacional" },
  { key: "overtime", label: "Extras", title: "Importe de horas extra", money: true },
  { key: "bonus", label: "Bono", title: "Bonos de la semana", money: true },
  { key: "aguinaldo", label: "Aguinaldo", title: "Aguinaldo pagado en esta nómina", money: true },
  { key: "otherIncome", label: "Otros", title: "Otras percepciones", money: true },
  { key: "deductions", label: "Descuentos", title: "Préstamos, anticipos, faltantes…", money: true },
];

export function PayrollEditor({
  action,
  lines: initial,
  payDate,
  notes,
  readOnly,
}: {
  action: (fd: FormData) => Promise<unknown>;
  lines: EditorLine[];
  payDate: string;
  notes: string;
  readOnly: boolean;
}) {
  const [lines, setLines] = useState(initial);
  const update = (id: number, key: keyof EditorLine, value: number | string) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  const calc = lines.map((l) => ({ l, t: payrollLine(l) }));
  const total = calc.reduce((a, c) => a + c.t.net, 0);
  const gross = calc.reduce((a, c) => a + c.t.gross, 0);
  const deductions = lines.reduce((a, l) => a + l.deductions, 0);

  return (
    <Form action={action} className="space-y-4">
      <input type="hidden" name="lines" value={JSON.stringify(lines.map(({ id, days, absences, vacationDays, overtime, bonus, aguinaldo, otherIncome, deductions, notes }) => ({ id, days, absences, vacationDays, overtime, bonus, aguinaldo, otherIncome, deductions, notes })))} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <div>
            <h2 className="text-[0.95rem] font-semibold">Detalle por empleado</h2>
            <p className="text-xs text-muted-foreground">Sueldo = salario diario × (días − faltas). Las vacaciones se pagan dentro de los días; aparte se suma la prima vacacional del 25%.</p>
          </div>
          {!readOnly && (
            <button
              type="button"
              className="btn-secondary h-8 text-xs"
              onClick={() => setLines((ls) => ls.map((l) => ({ ...l, aguinaldo: l.aguinaldoDue })))}
              title="Llena el aguinaldo proporcional de cada empleado (15 días por año trabajado)"
            >
              <Gift className="size-3.5" /> Incluir aguinaldo
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table text-sm">
            <thead>
              <tr>
                <th>Empleado</th>
                {NUM.map((c) => (
                  <th key={c.key} className="text-right" title={c.title}>
                    {c.label}
                  </th>
                ))}
                <th className="text-right">Percepciones</th>
                <th className="text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {calc.map(({ l, t }) => {
                const overVacation = l.vacationDays > l.vacationAvailable;
                return (
                  <tr key={l.id} className="align-top">
                    <td className="min-w-48">
                      <Link href={`/nomina/empleados/${l.employeeId}`} className="font-medium hover:text-primary hover:underline">
                        {l.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(l.dailySalary)} diario · {l.vacationAvailable} días de vac. disponibles
                      </div>
                      {!readOnly ? (
                        <input
                          className="input mt-1 h-7 text-xs"
                          placeholder="Nota (opcional)"
                          value={l.notes}
                          onChange={(e) => update(l.id, "notes", e.target.value)}
                        />
                      ) : (
                        l.notes && <div className="text-xs text-muted-foreground">{l.notes}</div>
                      )}
                    </td>
                    {NUM.map((c) => (
                      <td key={c.key} className="px-1 text-right">
                        {readOnly ? (
                          <span className="tabular-nums">{c.money ? (l[c.key] ? formatMoney(l[c.key] as number) : "—") : String(l[c.key])}</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step={c.money ? "0.01" : "0.5"}
                            aria-label={`${c.title} · ${l.name}`}
                            className={`input h-8 text-right tabular-nums ${c.money ? "w-[5.5rem]" : "w-14"} ${c.key === "vacationDays" && overVacation ? "border-amber-500" : ""}`}
                            value={l[c.key] as number}
                            onChange={(e) => update(l.id, c.key, Number(e.target.value) || 0)}
                          />
                        )}
                      </td>
                    ))}
                    <td className="text-right whitespace-nowrap tabular-nums">
                      {formatMoney(t.gross)}
                      {t.vacationPremium > 0 && <div className="text-[11px] text-muted-foreground">incl. prima {formatMoney(t.vacationPremium)}</div>}
                    </td>
                    <td className="text-right font-semibold whitespace-nowrap tabular-nums">{formatMoney(t.net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 border-t bg-muted/30 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <label className="block">
              <span className="label">Fecha de pago</span>
              <input type="date" name="payDate" defaultValue={payDate} disabled={readOnly} className="input" />
            </label>
            <label className="block min-w-64">
              <span className="label">Notas de la nómina</span>
              <input name="notes" defaultValue={notes} disabled={readOnly} className="input" />
            </label>
          </div>
          <dl className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Percepciones</dt>
              <dd className="tabular-nums">{formatMoney(gross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Descuentos</dt>
              <dd className="tabular-nums">−{formatMoney(deductions)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total a pagar</dt>
              <dd className="text-kurier tabular-nums">{formatMoney(total)}</dd>
            </div>
          </dl>
        </div>
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <SubmitButton>Guardar nómina</SubmitButton>
        </div>
      )}
    </Form>
  );
}
