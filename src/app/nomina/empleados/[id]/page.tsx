import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarHeart, Gift, Palmtree, Timer } from "lucide-react";
import { prisma } from "@/lib/db";
import { updateEmployee } from "@/app/actions/payroll";
import { EmployeeForm } from "@/components/EmployeeForm";
import { EmployeeKiosk } from "@/components/EmployeeKiosk";
import { PdfLink } from "@/components/list";
import { PageHeader, Panel, Stat, Empty } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { vacationTakenMap } from "@/lib/payroll-data";
import { aguinaldoDaysFor, benefits, monthlyCost, salaryRates, seniorityLabel, vacationDaysFor } from "@/lib/payroll";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const e = await prisma.employee.findUnique({
    where: { id },
    include: { payrollLines: { include: { run: true }, orderBy: { run: { periodStart: "desc" } }, take: 20 } },
  });
  if (!e) notFound();
  const taken = (await vacationTakenMap([e])).get(e.id) ?? 0;
  const b = benefits(e, taken);
  const rates = salaryRates(b.weeklySalary, e.workDays, e.hoursPerDay);
  const s = b.seniority;
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={e.name}
        back={{ href: "/nomina", label: "Nómina" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {!e.active && <Badge variant="secondary">Baja{e.endDate ? ` ${formatDate(e.endDate)}` : ""}</Badge>}
            {[e.position, e.area].filter(Boolean).join(" · ")}
            <span>· Ingreso {formatDate(e.startDate)}</span>
          </span>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Antigüedad" value={seniorityLabel(s)} hint={`Próximo aniversario: ${formatDate(s.nextAnniversary)}`} icon={CalendarHeart} />
        <Stat
          label="Vacaciones disponibles"
          value={s.years >= 1 ? `${formatNumber(b.vacationAvailable)} días` : "—"}
          hint={s.years >= 1 ? `${b.vacationEntitled} del periodo · ${formatNumber(b.vacationTaken)} tomados` : `Al cumplir 1 año tendrá 12 días`}
          icon={Palmtree}
        />
        <Stat label={`Aguinaldo ${year} a hoy`} value={formatMoney(b.aguinaldoToDate)} hint={`${formatNumber(b.aguinaldoDaysToDate)} días · al corte 20/dic: ${formatMoney(b.aguinaldoYear)} (${formatNumber(b.aguinaldoPayDays)} días)`} icon={Gift} />
        <Stat label="Costo mensual" value={formatMoney(monthlyCost(e))} hint="Sueldo + aguinaldo y prima prorrateados" icon={Timer} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Prestaciones de ley" description="Ley Federal del Trabajo. Sin ISR ni carga patronal.">
          <dl className="divide-y text-sm">
            {[
              ["Salario semanal", formatMoney(b.weeklySalary)],
              [`Jornada`, `${e.workDays} días (${e.workDays === 5 ? "descansa fin de semana" : "descansa domingo"}) · ${formatNumber(e.hoursPerDay)} h por día`],
              ["Salario diario", `${formatMoney(b.weeklySalary)} ÷ ${e.workDays} = ${formatMoney(rates.daily)}`],
              ["Salario por hora", `${formatMoney(rates.daily)} ÷ ${formatNumber(e.hoursPerDay)} = ${formatMoney(rates.hourly)}`],
              ["Salario mensual promedio", `${formatMoney(b.monthlySalary)} (6 días × 52 semanas ÷ 12)`],
              ["Vacaciones del periodo actual", s.years >= 1 ? `${b.vacationEntitled} días (desde ${formatDate(s.lastAnniversary)})` : "Aún no cumple 1 año"],
              ["Vacaciones acumuladas hacia el próximo aniversario", `${formatNumber(b.vacationAccrued)} de ${b.nextEntitlement} días`],
              ["Prima vacacional (25%)", `${formatMoney(b.vacationPremiumPerDay)} por día · ${formatMoney(b.vacationPremiumAvailable)} por los días disponibles`],
              [`Aguinaldo ${new Date().getFullYear()} (${b.aguinaldoDays} días por antigüedad)`, `${formatMoney(b.aguinaldoToDate)} a hoy · ${formatMoney(b.aguinaldoYear)} al corte del 20 de diciembre`],
              [
                "Días de aguinaldo a pagar",
                b.aguinaldoRawDays === b.aguinaldoPayDays
                  ? `${formatNumber(b.aguinaldoPayDays)} días (proporcional, con decimales)`
                  : `${formatNumber(b.aguinaldoRawDays)} proporcionales → ${formatNumber(b.aguinaldoPayDays)} días (con ,6 o más sube al siguiente)`,
              ],
              ["Bono fijo semanal", formatMoney(e.weeklyBonus)],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t px-5 py-3 text-xs text-muted-foreground">
            <div>Vacaciones (LFT): {[1, 2, 3, 4, 5, 6, 11, 16].map((y) => `${y}${y >= 6 ? "+" : ""} año${y === 1 ? "" : "s"}: ${vacationDaysFor(y)}`).join(" · ")}</div>
            <div className="mt-1">
              Aguinaldo: {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => `${y === 0 ? "1er año" : `${y} año${y === 1 ? "" : "s"}`}: ${aguinaldoDaysFor(y)}`).join(" · ")} (tope 30 días)
            </div>
          </div>
        </Panel>

        <Panel title="Historial de nómina">
          {e.payrollLines.length === 0 ? (
            <Empty>Sin nóminas registradas.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th className="text-right">Días</th>
                    <th className="text-right">Vac.</th>
                    <th className="text-right">Neto</th>
                    <th className="w-10">
                      <span className="sr-only">Recibo</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {e.payrollLines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/nomina/semanas/${l.runId}`} className="text-primary hover:underline">
                          {formatDate(l.run.periodStart)} – {formatDate(l.run.periodEnd)}
                        </Link>
                        {l.run.status !== "PAGADA" && <span className="ml-2 text-xs text-amber-700">borrador</span>}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatNumber(l.days - l.absences)}
                        {l.absences > 0 && <span className="text-xs text-rose-600"> ({formatNumber(l.absences)} faltas)</span>}
                      </td>
                      <td className="text-right tabular-nums">{l.vacationDays ? formatNumber(l.vacationDays) : "—"}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(l.net)}</td>
                      <td className="py-1 text-right">
                        <PdfLink href={`/api/pdf/nomina/${l.runId}?linea=${l.id}`} label="Recibo de nómina" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mb-6">
        <EmployeeKiosk e={e} />
      </div>

      <h2 className="mb-3 font-semibold">Datos del empleado</h2>
      <EmployeeForm action={updateEmployee.bind(null, e.id)} e={e} />
    </div>
  );
}
