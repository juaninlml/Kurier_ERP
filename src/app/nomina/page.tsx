import Link from "next/link";
import { CalendarDays, Gift, Plus, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { createPayrollRun } from "@/app/actions/payroll";
import { PageHeader, Panel, Stat, Empty, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { employeeBenefits } from "@/lib/payroll-data";
import { monthlyCost, PAID_DAYS_PER_WEEK, seniorityLabel } from "@/lib/payroll";
import { formatDate, formatMoney, formatNumber, round2, toInputDate } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nómina" };

/** Semana anterior completa (lunes a domingo). */
function lastWeek(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
  const start = new Date(d.getTime() - (dow + 7) * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start, end };
}

export default async function PayrollPage() {
  const [employees, runs] = await Promise.all([
    prisma.employee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.payrollRun.findMany({ orderBy: { periodStart: "desc" }, take: 30, include: { _count: { select: { lines: true } } } }),
  ]);
  const active = employees.filter((e) => e.active);
  const rows = await employeeBenefits(employees);
  const weekly = round2(active.reduce((a, e) => a + e.dailySalary * PAID_DAYS_PER_WEEK + e.weeklyBonus, 0));
  const monthly = round2(active.reduce((a, e) => a + monthlyCost(e), 0));
  const aguinaldo = round2(rows.filter((r) => r.employee.active).reduce((a, r) => a + r.b.aguinaldoYear, 0));
  const { start, end } = lastWeek();

  return (
    <div>
      <PageHeader
        title="Nómina"
        subtitle="Empleados, prestaciones de ley (antigüedad, vacaciones, prima vacacional y aguinaldo) y nómina semanal. Sin ISR ni carga patronal."
        actions={
          <Link href="/nomina/empleados/nuevo" className="btn-primary">
            <Plus className="size-4" /> Nuevo empleado
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Empleados activos" value={String(active.length)} icon={Users} />
        <Stat label="Nómina semanal" value={formatMoney(weekly)} hint="Salario diario × 6 días + bonos fijos" icon={CalendarDays} />
        <Stat label="Costo mensual" value={formatMoney(monthly)} hint="Con aguinaldo y prima prorrateados" icon={Wallet} href="/contabilidad/gastos-fijos" />
        <Stat label={`Aguinaldo ${new Date().getFullYear()}`} value={formatMoney(aguinaldo)} hint="Proyección al 31 de diciembre" icon={Gift} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Empleados">
          {employees.length === 0 ? (
            <Empty
              icon={Users}
              action={
                <Link href="/nomina/empleados/nuevo" className="btn-primary">
                  <Plus className="size-4" /> Dar de alta el primero
                </Link>
              }
            >
              Aún no hay empleados registrados.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Antigüedad</th>
                    <th className="text-right">Salario diario</th>
                    <th className="text-right">Semanal (6 días)</th>
                    <th className="text-right">Vacaciones</th>
                    <th className="text-right">Aguinaldo a hoy</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ employee: e, b }) => (
                    <tr key={e.id} className={e.active ? "" : "opacity-60"}>
                      <td>
                        <Link href={`/nomina/empleados/${e.id}`} className="font-medium text-primary hover:underline">
                          {e.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {[e.position, e.area].filter(Boolean).join(" · ") || "—"}
                          {!e.active && " · baja"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {seniorityLabel(b.seniority)}
                        <div className="text-xs text-muted-foreground">Desde {formatDate(e.startDate)}</div>
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(e.dailySalary)}</td>
                      <td className="text-right tabular-nums">{formatMoney(b.weeklySalary + e.weeklyBonus)}</td>
                      <td className="text-right whitespace-nowrap tabular-nums">
                        {b.vacationEntitled ? (
                          <>
                            <span className="font-medium">{formatNumber(b.vacationAvailable)}</span>
                            <span className="text-muted-foreground"> / {b.vacationEntitled} días</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Al cumplir 1 año: 12</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{formatMoney(b.aguinaldoToDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Nueva nómina semanal" description="Se arma con los empleados activos; después ajustas faltas, vacaciones, extras y descuentos.">
            <Form action={createPayrollRun} className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Del">
                  <input type="date" name="periodStart" required defaultValue={toInputDate(start)} className="input" />
                </Field>
                <Field label="Al">
                  <input type="date" name="periodEnd" required defaultValue={toInputDate(end)} className="input" />
                </Field>
              </div>
              <Field label="Fecha de pago">
                <input type="date" name="payDate" defaultValue={toInputDate(new Date(end.getTime() + 5 * 86400000))} className="input" />
              </Field>
              <SubmitButton className="btn-primary w-full" pendingText="Creando…">
                <Plus className="size-4" /> Crear nómina
              </SubmitButton>
            </Form>
          </Panel>

          <Panel title="Nóminas">
            {runs.length === 0 ? (
              <Empty icon={CalendarDays}>Aún no hay nóminas.</Empty>
            ) : (
              <ul className="divide-y">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link href={`/nomina/semanas/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                      <div>
                        <div className="text-sm font-medium">
                          {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                        </div>
                        <div className="text-xs text-muted-foreground">{r._count.lines} empleado(s)</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{formatMoney(r.total)}</div>
                        <Badge
                          variant="outline"
                          className={
                            r.status === "PAGADA"
                              ? "border-transparent bg-emerald-50 text-emerald-700"
                              : "border-transparent bg-amber-50 text-amber-800"
                          }
                        >
                          {r.status === "PAGADA" ? "Pagada" : "Borrador"}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
