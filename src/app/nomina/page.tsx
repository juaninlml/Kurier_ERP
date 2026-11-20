import Link from "next/link";
import { CalendarDays, Gift, Plus, Users, Wallet, Clock, Network } from "lucide-react";
import { prisma } from "@/lib/db";
import { createPayrollRun } from "@/app/actions/payroll";
import { PageHeader, Panel, Stat, Empty, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui/badge";
import { ColumnChart } from "@/components/charts";
import { employeeBenefits, jobCatalog } from "@/lib/payroll-data";
import { groupByOrg } from "@/lib/org";
import { Fragment } from "react";
import { monthlyCost, seniorityLabel, weeklyOf } from "@/lib/payroll";
import { formatDate, formatMoney, formatNumber, round2, toInputDate } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { Tr } from "@/components/Tr";
import { requestLocale } from "@/lib/request-lang";
import { brandOptions } from "@/lib/brands";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Nómina") };
}

/** Semana anterior completa (lunes a domingo). */
function lastWeek(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
  const start = new Date(d.getTime() - (dow + 7) * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start, end };
}

export default async function PayrollPage() {
  const t = await getT();
  const [employees, runs, brands, lastRun, catalog] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.payrollRun.findMany({
      orderBy: { periodStart: "desc" },
      take: 30,
      include: { _count: { select: { lines: true } } },
    }),
    brandOptions(),
    // La nueva nómina la paga la misma marca que la última (ej. LOE Fulfillment)
    prisma.payrollRun.findFirst({
      orderBy: { createdAt: "desc" },
      select: { brandId: true },
    }),
    jobCatalog(),
  ]);
  const defaultBrand = brands.some((b) => b.id === lastRun?.brandId) ? lastRun!.brandId! : 0;
  const active = employees.filter((e) => e.active);
  const rows = await employeeBenefits(employees);
  // Plantilla agrupada por área y después por departamento (activos primero dentro de cada grupo)
  const groups = groupByOrg(rows, (r) => r.employee, catalog);
  const weekly = round2(active.reduce((a, e) => a + weeklyOf(e) + e.weeklyBonus, 0));
  const monthly = round2(active.reduce((a, e) => a + monthlyCost(e), 0));
  const aguinaldo = round2(rows.filter((r) => r.employee.active).reduce((a, r) => a + r.b.aguinaldoYear, 0));
  const { start, end } = lastWeek();

  return (
    <div>
      <PageHeader
        title={t("Nómina")}
        subtitle={t("Empleados, prestaciones de ley (antigüedad, vacaciones, prima vacacional y aguinaldo) y nómina semanal. Sin ISR ni carga patronal.")}
        actions={
          <>
            <Link href="/nomina/puestos" className="btn-secondary">
              <Network className="size-4" /> {t("Puestos")}
            </Link>
            <Link href="/nomina/asistencias" className="btn-secondary">
              <Clock className="size-4" /> {t("Asistencias")}
            </Link>
            <Link href="/nomina/empleados/nuevo" className="btn-primary">
              <Plus className="size-4" /> {t("Nuevo empleado")}
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("Empleados activos")} value={String(active.length)} icon={Users} />
        <Stat label={t("Nómina semanal")} value={formatMoney(weekly)} hint={t("Salarios semanales + bonos fijos")} icon={CalendarDays} />
        <Stat
          label={t("Costo mensual")}
          value={formatMoney(monthly)}
          hint={t("Con aguinaldo y prima prorrateados")}
          icon={Wallet}
          href="/contabilidad/gastos-fijos"
        />
        <Stat
          label={t("Aguinaldo {v0}", { v0: new Date().getFullYear() })}
          value={formatMoney(aguinaldo)}
          hint={t("A pagar al corte del 20 de diciembre")}
          icon={Gift}
        />
      </div>

      {runs.length > 1 && (
        <Panel
          className="mb-6"
          title={t("Costo de nómina por semana")}
          description={t("Total neto de las últimas {n} nóminas", {
            n: Math.min(runs.length, 16),
          })}
          bodyClassName="p-5"
        >
          <ColumnChart
            height={180}
            series={[{ key: "total", name: t("Total"), color: "var(--chart-1)" }]}
            points={runs
              .slice(0, 16)
              .reverse()
              .map((r) => ({
                key: String(r.id),
                label: r.periodStart
                  .toLocaleDateString(requestLocale(), {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })
                  .replace(".", ""),
                full: `${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}${r.status === "PAGADA" ? "" : ` · ${t("Borrador")}`}`,
                values: { total: r.total },
              }))}
          />
        </Panel>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={t("Empleados")}>
          {employees.length === 0 ? (
            <Empty
              icon={Users}
              action={
                <Link href="/nomina/empleados/nuevo" className="btn-primary">
                  <Plus className="size-4" /> {t("Dar de alta el primero")}
                </Link>
              }
            >
              <Tr>Aún no hay empleados registrados.</Tr>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Empleado")}</th>
                    <th>{t("Antigüedad")}</th>
                    <th className="text-right">{t("Salario diario")}</th>
                    <th className="text-right">{t("Semanal")}</th>
                    <th className="text-right">{t("Vacaciones")}</th>
                    <th className="text-right">{t("Aguinaldo a hoy")}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.area}>
                      <tr className="bg-muted/60">
                        <th colSpan={6} className="text-left text-xs font-semibold tracking-wide uppercase">
                          {g.area || t("Sin área")}{" "}
                          <span className="font-normal text-muted-foreground normal-case">
                            · {g.count} <Tr>empleado(s)</Tr>
                          </span>
                        </th>
                      </tr>
                      {g.departments.map((d) => (
                        <Fragment key={d.department}>
                          {(d.department || g.departments.length > 1) && (
                            <tr>
                              <td colSpan={6} className="py-1.5 pl-6 text-xs font-medium text-muted-foreground">
                                {d.department || t("Sin departamento")}
                              </td>
                            </tr>
                          )}
                          {d.items.map(({ employee: e, b }) => (
                            <tr key={e.id} className={e.active ? "" : "opacity-60"}>
                              <td>
                                <Link href={`/nomina/empleados/${e.id}`} className="font-medium text-primary hover:underline">
                                  {e.name}
                                </Link>
                                <div className="text-xs text-muted-foreground">
                                  {e.position || "—"}
                                  {!e.active && t(" · baja")}
                                </div>
                              </td>
                              <td className="whitespace-nowrap">
                                {seniorityLabel(b.seniority)}
                                <div className="text-xs text-muted-foreground">
                                  <Tr>Desde</Tr> {formatDate(e.startDate)}
                                </div>
                              </td>
                              <td className="text-right tabular-nums">{formatMoney(e.dailySalary)}</td>
                              <td className="text-right tabular-nums">{formatMoney(b.weeklySalary + e.weeklyBonus)}</td>
                              <td className="text-right whitespace-nowrap tabular-nums">
                                {b.vacationEntitled ? (
                                  <>
                                    <span className="font-medium">{formatNumber(b.vacationAvailable)}</span>
                                    <span className="text-muted-foreground">
                                      {" "}
                                      / {b.vacationEntitled} <Tr>días</Tr>
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{t("Al cumplir 1 año: 12")}</span>
                                )}
                              </td>
                              <td className="text-right tabular-nums">{formatMoney(b.aguinaldoToDate)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title={t("Nueva nómina semanal")}
            description={t("Se arma con los empleados activos; después ajustas faltas, vacaciones, extras y descuentos.")}
          >
            <Form action={createPayrollRun} className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("Del")}>
                  <input type="date" name="periodStart" required defaultValue={toInputDate(start)} className="input" />
                </Field>
                <Field label={t("Al")}>
                  <input type="date" name="periodEnd" required defaultValue={toInputDate(end)} className="input" />
                </Field>
              </div>
              <Field label={t("Marca que paga")}>
                <select name="brandId" defaultValue={defaultBrand} className="input">
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Fecha de pago")}>
                <input type="date" name="payDate" defaultValue={toInputDate(new Date(end.getTime() + 5 * 86400000))} className="input" />
              </Field>
              <SubmitButton className="btn-primary w-full" pendingText={t("Creando…")}>
                <Plus className="size-4" /> {t("Crear nómina")}
              </SubmitButton>
            </Form>
          </Panel>

          <Panel title={t("Nóminas")}>
            {runs.length === 0 ? (
              <Empty icon={CalendarDays}>{t("Aún no hay nóminas.")}</Empty>
            ) : (
              <ul className="divide-y">
                {runs.map((r) => (
                  <li key={r.id}>
                    <Link href={`/nomina/semanas/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
                      <div>
                        <div className="text-sm font-medium">
                          {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r._count.lines} <Tr>empleado(s)</Tr>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{formatMoney(r.total)}</div>
                        <Badge
                          variant="outline"
                          className={
                            r.status === "PAGADA" ? "border-transparent bg-emerald-50 text-emerald-700" : "border-transparent bg-amber-50 text-amber-800"
                          }
                        >
                          {r.status === "PAGADA" ? t("Pagada") : t("Borrador")}
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
