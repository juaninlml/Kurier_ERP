"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Gift } from "lucide-react";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { payrollLine } from "@/lib/payroll";
import { formatMoney, formatNumber } from "@/lib/money";
import { cn } from "@/lib/utils";

export type EditorLine = {
  id: number;
  employeeId: number;
  name: string;
  position: string;
  weeklySalary: number;
  workDays: number;
  hoursPerDay: number;
  days: number;
  absences: number;
  vacationDays: number;
  overtime: number;
  bonus: number;
  bonusNote: string;
  aguinaldo: number;
  otherIncome: number;
  deductions: number;
  deductionNote: string;
  notes: string;
  /** Vacaciones disponibles sin contar esta nómina. */
  vacationAvailable: number;
  /** Aguinaldo a pagar al corte del 20 de diciembre. */
  aguinaldoDue: number;
};

type NumKey = "days" | "absences" | "vacationDays" | "overtime" | "bonus" | "aguinaldo" | "otherIncome" | "deductions";

export function PayrollEditor({
  action,
  runId,
  lines: initial,
  payDate,
  notes,
  readOnly,
}: {
  action: (fd: FormData) => Promise<unknown>;
  runId: number;
  lines: EditorLine[];
  payDate: string;
  notes: string;
  readOnly: boolean;
}) {
  const [lines, setLines] = useState(initial);
  const update = (id: number, patch: Partial<EditorLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const calc = lines.map((l) => ({ l, t: payrollLine(l) }));
  const total = calc.reduce((a, c) => a + c.t.net, 0);
  const gross = calc.reduce((a, c) => a + c.t.gross, 0);
  const deductions = calc.reduce((a, c) => a + c.t.totalDeductions, 0);
  const payload = lines.map(({ id, workDays, days, absences, vacationDays, overtime, bonus, bonusNote, aguinaldo, otherIncome, deductions, deductionNote, notes }) => ({
    id,
    workDays,
    days,
    absences,
    vacationDays,
    overtime,
    bonus,
    bonusNote,
    aguinaldo,
    otherIncome,
    deductions,
    deductionNote,
    notes,
  }));

  const num = (l: EditorLine, key: NumKey, label: string, opts: { money?: boolean; hint?: string; warn?: boolean } = {}) => (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {readOnly ? (
        <div className="py-1.5 text-sm tabular-nums">{opts.money ? (l[key] ? formatMoney(l[key]) : "—") : formatNumber(l[key])}</div>
      ) : (
        <input
          type="number"
          min="0"
          step={opts.money ? "0.01" : "0.5"}
          className={cn("input h-8 text-right tabular-nums", opts.warn && "border-amber-500")}
          value={l[key]}
          onChange={(e) => update(l.id, { [key]: Number(e.target.value) || 0 } as Partial<EditorLine>)}
        />
      )}
      {opts.hint && <span className="mt-0.5 block text-[10px] text-muted-foreground">{opts.hint}</span>}
    </label>
  );

  return (
    <Form action={action} className="space-y-4">
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-xs text-muted-foreground">
          Salario diario = semanal ÷ días laborables (5 o 6) · por hora = diario ÷ horas de la jornada. Las faltas injustificadas se descuentan a salario diario. Las
          vacaciones se pagan dentro de los días y aparte se suma la prima vacacional del 25%.
        </p>
        <div className="flex gap-2">
          {!readOnly && (
            <button
              type="button"
              className="btn-secondary h-8 text-xs"
              onClick={() => setLines((ls) => ls.map((l) => ({ ...l, aguinaldo: l.aguinaldoDue })))}
              title="Llena el aguinaldo de cada empleado al corte del 20 de diciembre"
            >
              <Gift className="size-3.5" /> Incluir aguinaldo
            </button>
          )}
          <a href={`/api/pdf/nomina/${runId}`} target="_blank" className="btn-secondary h-8 text-xs">
            <FileText className="size-3.5" /> Recibos (PDF)
          </a>
        </div>
      </div>

      {calc.map(({ l, t }) => (
        <section key={l.id} className="card overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <Link href={`/nomina/empleados/${l.employeeId}`} className="font-semibold hover:text-primary hover:underline">
                {l.name}
              </Link>
              <div className="text-xs text-muted-foreground">
                {l.position || "—"} · {formatNumber(l.vacationAvailable)} días de vacaciones disponibles
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(
                [
                  ["Semanal", formatMoney(l.weeklySalary)],
                  ["Diario", formatMoney(t.daily)],
                  [`Hora (${formatNumber(l.hoursPerDay)} h)`, formatMoney(t.hourly)],
                ] as const
              ).map(([k, v]) => (
                <span key={k} className="rounded-md bg-muted px-2 py-1">
                  <span className="text-muted-foreground">{k} </span>
                  <span className="font-semibold tabular-nums">{v}</span>
                </span>
              ))}
              <a href={`/api/pdf/nomina/${runId}?linea=${l.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-primary hover:bg-muted">
                <FileText className="size-3.5" /> Recibo
              </a>
            </div>
          </header>

          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                <label className="block min-w-0">
                  <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Jornada</span>
                  {readOnly ? (
                    <div className="py-1.5 text-sm">{l.workDays} días</div>
                  ) : (
                    <select
                      className="input h-8"
                      value={l.workDays}
                      onChange={(e) => {
                        const wd = Number(e.target.value);
                        update(l.id, { workDays: wd, days: Math.min(wd, l.days === l.workDays ? wd : l.days) });
                      }}
                    >
                      <option value={6}>6 días</option>
                      <option value={5}>5 días</option>
                    </select>
                  )}
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{l.workDays === 5 ? "Descansa fin de semana" : "Descansa domingo"}</span>
                </label>
                {num(l, "days", "Días a pagar", { hint: `de ${l.workDays}` })}
                {num(l, "absences", "Faltas injustif.", { hint: t.absenceDeduction ? `−${formatMoney(t.absenceDeduction)}` : undefined })}
                {num(l, "vacationDays", "Vacaciones", { warn: l.vacationDays > l.vacationAvailable, hint: t.vacationPremium ? `prima ${formatMoney(t.vacationPremium)}` : undefined })}
                {num(l, "bonus", "Bono semanal", { money: true })}
                {num(l, "overtime", "Horas extra ($)", { money: true })}
                {num(l, "aguinaldo", "Aguinaldo", { money: true })}
                {num(l, "deductions", "Préstamo / otros", { money: true })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[140px_repeat(3,minmax(0,1fr))]">
                {num(l, "otherIncome", "Otras percepciones", { money: true })}
                {(
                  [
                    ["bonusNote", "Motivo del bono", "Ej. apoyo en picking, puntualidad"],
                    ["deductionNote", "Motivo del descuento", "Ej. abono a préstamo"],
                    ["notes", "Comentarios", "Opcional"],
                  ] as const
                ).map(([key, label, ph]) => (
                  <label key={key} className="block min-w-0">
                    <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
                    {readOnly ? (
                      <div className="py-1.5 text-sm">{l[key] || "—"}</div>
                    ) : (
                      <input
                        className={cn("input h-8 text-sm", key === "bonusNote" && l.bonus > 0 && !l.bonusNote.trim() && "border-amber-500")}
                        placeholder={ph}
                        value={l[key]}
                        onChange={(e) => update(l.id, { [key]: e.target.value } as Partial<EditorLine>)}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>

            <dl className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">
                  Sueldo <span className="text-[11px]">({formatNumber(l.days)} × {formatMoney(t.daily)})</span>
                </dt>
                <dd className="tabular-nums">{formatMoney(t.base)}</dd>
              </div>
              {t.vacationPremium > 0 && <Row k="Prima vacacional" v={t.vacationPremium} />}
              {l.bonus > 0 && <Row k="Bono" v={l.bonus} />}
              {l.overtime > 0 && <Row k="Horas extra" v={l.overtime} />}
              {l.aguinaldo > 0 && <Row k="Aguinaldo" v={l.aguinaldo} />}
              {l.otherIncome > 0 && <Row k="Otras percepciones" v={l.otherIncome} />}
              {t.absenceDeduction > 0 && <Row k={`Faltas (${formatNumber(l.absences)} × ${formatMoney(t.daily)})`} v={-t.absenceDeduction} />}
              {l.deductions > 0 && <Row k="Préstamo / otros" v={-l.deductions} />}
              <div className="flex justify-between border-t pt-1.5 text-base font-semibold">
                <dt>Neto</dt>
                <dd className="text-kurier tabular-nums">{formatMoney(t.net)}</dd>
              </div>
            </dl>
          </div>
        </section>
      ))}

      <div className="card flex flex-wrap items-end justify-between gap-4 px-5 py-4">
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
            <dt className="text-muted-foreground">Deducciones (faltas, préstamos)</dt>
            <dd className="tabular-nums">−{formatMoney(deductions)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total a pagar</dt>
            <dd className="text-kurier tabular-nums">{formatMoney(total)}</dd>
          </div>
        </dl>
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <SubmitButton>Guardar nómina</SubmitButton>
        </div>
      )}
    </Form>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("tabular-nums", v < 0 && "text-rose-700")}>{v < 0 ? `−${formatMoney(-v)}` : formatMoney(v)}</dd>
    </div>
  );
}
