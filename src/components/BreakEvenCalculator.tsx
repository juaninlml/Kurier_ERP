"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { breakEven } from "@/lib/payroll";
import { formatMoney, formatNumber } from "@/lib/money";
import { saveBreakEven } from "@/app/actions/payroll";
import { cn } from "@/lib/utils";
import { Tr } from "@/components/Tr";
import { useT } from "@/components/I18nProvider";

export type BreakEvenInputs = {
  beOrderRate: number;
  beShippingCost: number;
  beShippingMarkup: number;
  beGuideShare: number;
  beVariableCost: number;
  beSystemFee: number;
  beClients: number;
  beWorkingDays: number;
  beIncludePayroll: boolean;
};

/** Calculadora de punto de equilibrio: se recalcula al escribir y guarda los supuestos. */
export function BreakEvenCalculator({
  initial,
  fixedOther,
  payrollMonthly,
  activeClients,
}: {
  initial: BreakEvenInputs;
  fixedOther: number;
  payrollMonthly: number;
  activeClients: number;
}) {
  const t = useT();
  const [v, setV] = useState(initial);
  const set = (k: keyof BreakEvenInputs, val: number | boolean) => setV((x) => ({ ...x, [k]: val }));
  const clients = v.beClients > 0 ? v.beClients : activeClients;
  const fixedMonthly = fixedOther + (v.beIncludePayroll ? payrollMonthly : 0);
  const params = {
    fixedMonthly,
    orderRate: v.beOrderRate,
    shippingCost: v.beShippingCost,
    shippingMarkup: v.beShippingMarkup,
    guideShare: v.beGuideShare,
    variableCost: v.beVariableCost,
    systemFee: v.beSystemFee,
    clients,
    workingDays: v.beWorkingDays,
  };
  const r = breakEven(params);
  const ok = Number.isFinite(r.ordersDay);
  const rates = [-10, -5, 0, 5, 10, 15].map((d) => Math.max(1, v.beOrderRate + d));

  const num = (k: keyof BreakEvenInputs, label: string, opts: { step?: string; suffix?: string; hint?: string } = {}) => (
    <label className="block">
      <span className="label">{t(label)}</span>
      <div className="relative">
        <input
          name={k}
          type="number"
          min="0"
          step={opts.step ?? "0.01"}
          className={cn("input text-right", opts.suffix && "pr-9")}
          value={v[k] as number}
          onChange={(e) => set(k, Number(e.target.value) || 0)}
        />
        {opts.suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{opts.suffix}</span>}
      </div>
      {opts.hint && <span className="mt-1 block text-[11px] text-muted-foreground">{opts.hint}</span>}
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Form action={saveBreakEven} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {num("beOrderRate", "Tarifa promedio por orden", { hint: t("Fulfillment sin IVA") })}
          {num("beVariableCost", "Costo variable por orden", { hint: t("Empaque, etiqueta, insumos") })}
          {num("beShippingCost", "Costo promedio de guía")}
          {num("beShippingMarkup", "Markup sobre la guía", { suffix: "%", step: "0.1" })}
          {num("beGuideShare", "Órdenes con guía de Kurier", { suffix: "%", step: "1" })}
          {num("beWorkingDays", "Días operativos al mes", { step: "1", hint: t("Lunes a sábado ≈ 26") })}
          {num("beSystemFee", "Cobro de sistema / cliente", { hint: t("Mensual") })}
          {num("beClients", "Clientes que pagan sistema", { step: "1", hint: t("0 = clientes activos ({v0})", { v0: activeClients }) })}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="beIncludePayroll" checked={v.beIncludePayroll} onChange={(e) => set("beIncludePayroll", e.target.checked)} />
          <Tr>Incluir la nómina de empleados activos (</Tr>{formatMoney(payrollMonthly)} / <Tr>mes</Tr>)
        </label>
        <div className="flex justify-end">
          <SubmitButton className="btn-secondary"><Tr>Guardar supuestos</Tr></SubmitButton>
        </div>
      </Form>

      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Target className="size-4" /> <Tr>Para cubrir los gastos fijos necesitas</Tr>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <div className="text-4xl font-semibold tracking-tight text-primary tabular-nums">{ok ? formatNumber(r.ordersDay) : "—"}</div>
              <div className="text-sm text-muted-foreground"><Tr>órdenes por día</Tr></div>
            </div>
            <div className="pb-1">
              <div className="text-xl font-semibold tabular-nums">{ok ? formatNumber(r.ordersMonth) : "—"}</div>
              <div className="text-xs text-muted-foreground"><Tr>órdenes al mes</Tr></div>
            </div>
          </div>
          {!ok && <p className="mt-2 text-sm text-rose-700"><Tr>El margen por orden es cero o negativo: revisa la tarifa y el costo variable.</Tr></p>}
        </div>

        <dl className="card divide-y text-sm">
          {[
            [t("Gastos fijos mensuales"), formatMoney(fixedMonthly), v.beIncludePayroll ? t("Incluye nómina {v0}", { v0: formatMoney(payrollMonthly) }) : t("Sin nómina")],
            [t("− Ingreso por sistema"), formatMoney(r.systemIncome), t("{v0} cliente(s) × {v1}", { v0: clients, v1: formatMoney(v.beSystemFee) })],
            [t("= Por cubrir con órdenes"), formatMoney(r.toCover), ""],
            [t("Margen por orden"), formatMoney(r.marginPerOrder), t("{v0} tarifa + {v1} markup de guía − {v2} variable", { v0: formatMoney(v.beOrderRate), v1: formatMoney(r.shippingMargin), v2: formatMoney(v.beVariableCost) })],
            [t("Facturado por orden al cliente"), formatMoney(r.billedPerOrder), t("Tarifa + guía con markup, sin IVA")],
            [t("Facturación mensual en el equilibrio"), ok ? formatMoney(r.revenueMonth) : "—", t("Sin IVA, incluye sistema")],
          ].map(([label, value, hint]) => (
            <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5">
              <dt>
                <div className={label.startsWith("=") ? "font-semibold" : ""}>{label}</div>
                {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
              </dt>
              <dd className={cn("font-medium whitespace-nowrap tabular-nums", label.startsWith("=") && "font-semibold")}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="card overflow-hidden">
          <div className="border-b px-4 py-2.5 text-sm font-medium"><Tr>Sensibilidad a la tarifa promedio</Tr></div>
          <div className="overflow-x-auto">
            <table className="table text-xs">
              <thead>
                <tr>
                  <th><Tr>Tarifa</Tr></th>
                  {rates.map((t) => (
                    <th key={t} className={cn("text-right", t === v.beOrderRate && "text-primary")}>
                      {formatMoney(t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><Tr>Órdenes / día</Tr></td>
                  {rates.map((t) => {
                    const x = breakEven({ ...params, orderRate: t });
                    return (
                      <td key={t} className={cn("text-right tabular-nums", t === v.beOrderRate && "font-semibold text-primary")}>
                        {Number.isFinite(x.ordersDay) ? formatNumber(x.ordersDay) : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
