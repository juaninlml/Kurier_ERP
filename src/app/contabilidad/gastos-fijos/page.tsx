import Link from "next/link";
import { Building2, ChevronDown, Plus, Trash2, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { createFixedExpense, deleteFixedExpense, updateFixedExpense } from "@/app/actions/payroll";
import { PageHeader, Panel, Stat, Empty, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { BreakEvenCalculator } from "@/components/BreakEvenCalculator";
import { Badge } from "@/components/ui/badge";
import { FIXED_CATEGORIES, FREQUENCIES, monthlyCost, toMonthly } from "@/lib/payroll";
import { formatMoney, round2 } from "@/lib/money";
import type { FixedExpense } from "@prisma/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gastos fijos y punto de equilibrio" };

function ExpenseFields({ e }: { e?: FixedExpense }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <Field label="Concepto *">
        <input name="name" required defaultValue={e?.name} className="input" placeholder="Renta de bodega" />
      </Field>
      <Field label="Categoría">
        <select name="category" defaultValue={e?.category ?? "Renta"} className="input">
          {FIXED_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Monto *">
        <input name="amount" type="number" step="0.01" min="0" required defaultValue={e?.amount} className="input text-right" />
      </Field>
      <Field label="Frecuencia">
        <select name="frequency" defaultValue={e?.frequency ?? "MENSUAL"} className="input">
          {Object.entries(FREQUENCIES).map(([k, f]) => (
            <option key={k} value={k}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notas" className="sm:col-span-2 lg:col-span-4">
        <input name="notes" defaultValue={e?.notes} className="input" placeholder="Opcional" />
      </Field>
    </div>
  );
}

export default async function FixedExpensesPage() {
  const [expenses, employees, s, activeClients] = await Promise.all([
    prisma.fixedExpense.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { id: "asc" }] }),
    prisma.employee.findMany({ where: { active: true } }),
    getSettings(),
    prisma.client.count({ where: { active: true } }),
  ]);
  const active = expenses.filter((e) => e.active);
  const fixedOther = round2(active.reduce((a, e) => a + toMonthly(e.amount, e.frequency), 0));
  const payrollMonthly = round2(employees.reduce((a, e) => a + monthlyCost(e), 0));
  const byCategory = new Map<string, number>();
  for (const e of active) byCategory.set(e.category, round2((byCategory.get(e.category) ?? 0) + toMonthly(e.amount, e.frequency)));
  if (s.beIncludePayroll && payrollMonthly) byCategory.set("Nómina (empleados)", round2((byCategory.get("Nómina (empleados)") ?? 0) + payrollMonthly));
  const total = round2(fixedOther + (s.beIncludePayroll ? payrollMonthly : 0));

  return (
    <div>
      <PageHeader
        title="Gastos fijos y punto de equilibrio"
        subtitle="Registra los gastos recurrentes de la operación y calcula cuántas órdenes diarias se necesitan para cubrirlos."
        back={{ href: "/contabilidad", label: "Contabilidad" }}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Gastos fijos al mes" value={formatMoney(total)} hint={`${active.length} gasto(s) activos`} icon={Wallet} />
        <Stat label="Nómina mensual" value={formatMoney(payrollMonthly)} hint={`${employees.length} empleado(s) · con aguinaldo y prima`} icon={Users} href="/nomina" />
        <Stat label="Gastos sin nómina" value={formatMoney(fixedOther)} hint="Renta, servicios, insumos…" icon={Building2} />
      </div>

      <Panel title="Punto de equilibrio" description="Los valores se recalculan al escribir. Guarda los supuestos para que queden como predeterminados." className="mb-6" bodyClassName="p-5">
        <BreakEvenCalculator
          fixedOther={fixedOther}
          payrollMonthly={payrollMonthly}
          activeClients={activeClients}
          initial={{
            beOrderRate: s.beOrderRate,
            beShippingCost: s.beShippingCost,
            beShippingMarkup: s.beShippingMarkup,
            beGuideShare: s.beGuideShare,
            beVariableCost: s.beVariableCost,
            beSystemFee: s.beSystemFee,
            beClients: s.beClients,
            beWorkingDays: s.beWorkingDays,
            beIncludePayroll: s.beIncludePayroll,
          }}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Gastos fijos" description="Montos tal como se pagan; se convierten a mensual según su frecuencia.">
          {expenses.length === 0 ? (
            <Empty icon={Wallet}>Agrega la renta, servicios, insumos y demás gastos recurrentes.</Empty>
          ) : (
            <ul className="divide-y">
              {expenses.map((e) => (
                <li key={e.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={e.active ? "font-medium" : "font-medium text-muted-foreground line-through"}>{e.name}</span>
                          <Badge variant="secondary">{e.category}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(e.amount)} {FREQUENCIES[e.frequency as keyof typeof FREQUENCIES]?.label.toLowerCase()}
                          {e.notes && ` · ${e.notes}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">{formatMoney(toMonthly(e.amount, e.frequency))}</div>
                        <div className="text-[11px] text-muted-foreground">al mes</div>
                      </div>
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t bg-muted/30 px-5 py-4">
                      <Form action={updateFixedExpense.bind(null, e.id)} className="space-y-3">
                        <ExpenseFields e={e} />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="active" defaultChecked={e.active} /> Activo
                          </label>
                          <SubmitButton>Guardar</SubmitButton>
                        </div>
                      </Form>
                      <Form action={deleteFixedExpense.bind(null, e.id)} className="mt-2">
                        <ConfirmButton message={`¿Eliminar el gasto “${e.name}”?`} className="btn-danger h-8 text-xs">
                          <Trash2 className="size-3.5" /> Eliminar
                        </ConfirmButton>
                      </Form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <details className="group border-t" open={expenses.length === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-primary hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
              <Plus className="size-4" /> Agregar gasto fijo
            </summary>
            <div className="border-t bg-muted/30 px-5 py-4">
              <Form action={createFixedExpense} className="space-y-3">
                <ExpenseFields />
                <div className="flex justify-end">
                  <SubmitButton>Agregar</SubmitButton>
                </div>
              </Form>
            </div>
          </details>
        </Panel>

        <Panel title="Por categoría" description="Mensual">
          {byCategory.size === 0 ? (
            <Empty>Sin gastos.</Empty>
          ) : (
            <ul className="space-y-3 p-5">
              {[...byCategory.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <li key={cat}>
                    <div className="flex justify-between text-sm">
                      <span>{cat}</span>
                      <span className="font-medium tabular-nums">{formatMoney(amt)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${total ? Math.max(2, (amt / total) * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
            </ul>
          )}
          {payrollMonthly > 0 && (
            <p className="border-t px-5 py-3 text-xs text-muted-foreground">
              La nómina se toma de los{" "}
              <Link href="/nomina" className="text-primary hover:underline">
                empleados activos
              </Link>
              ; no la captures también como gasto fijo.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
