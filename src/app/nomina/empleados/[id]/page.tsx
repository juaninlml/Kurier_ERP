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
import { unjustifiedMap, vacationTakenMap } from "@/lib/payroll-data";
import { EmployeeIncidents } from "@/components/EmployeeIncidents";
import { aguinaldoDaysFor, benefits, monthlyCost, salaryRates, seniorityLabel, vacationDaysFor } from "@/lib/payroll";
import { formatDate, formatMoney, formatNumber } from "@/lib/money";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  const e = await prisma.employee.findUnique({
    where: { id },
    include: { payrollLines: { include: { run: true }, orderBy: { run: { periodStart: "desc" } }, take: 20 } },
  });
  if (!e) notFound();
  const [takenMap, absentMap] = await Promise.all([vacationTakenMap([e]), unjustifiedMap([e.id])]);
  const taken = takenMap.get(e.id) ?? 0;
  const absent = absentMap.get(e.id) ?? 0;
  const b = benefits(e, taken, new Date(), absent);
  const rates = salaryRates(b.weeklySalary, e.workDays, e.hoursPerDay);
  const s = b.seniority;
  const year = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={e.name}
        back={{ href: "/nomina", label: t("Nómina") }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {!e.active && <Badge variant="secondary"><Tr>Baja</Tr>{e.endDate ? ` ${formatDate(e.endDate)}` : ""}</Badge>}
            {[e.position, e.department, e.area].filter(Boolean).join(" · ")}
            <span><Tr>· Ingreso</Tr> {formatDate(e.startDate)}</span>
          </span>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Antigüedad" value={seniorityLabel(s)} hint={t("Próximo aniversario: {v0}", { v0: formatDate(s.nextAnniversary) })} icon={CalendarHeart} />
        <Stat
          label="Vacaciones disponibles"
          value={s.years >= 1 ? `${formatNumber(b.vacationAvailable)} días` : "—"}
          hint={s.years >= 1 ? t("{v0} del periodo · {v1} tomados", { v0: b.vacationEntitled, v1: formatNumber(b.vacationTaken) }) : `Al cumplir 1 año tendrá 12 días`}
          icon={Palmtree}
        />
        <Stat
          label={t("Aguinaldo {v0} a hoy", { v0: year })}
          value={formatMoney(b.aguinaldoToDate)}
          hint={
            t("{v0} días · al corte 20/dic: {v1} ({v2} días)", { v0: formatNumber(b.aguinaldoDaysToDate), v1: formatMoney(b.aguinaldoYear), v2: formatNumber(b.aguinaldoPayDays) }) +
            (absent ? ` · ${t("−{v0} faltas injustificadas", { v0: formatNumber(absent) })}` : "")
          }
          icon={Gift}
        />
        <Stat label="Costo mensual" value={formatMoney(monthlyCost(e))} hint="Sueldo + aguinaldo y prima prorrateados" icon={Timer} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Prestaciones de ley" description="Ley Federal del Trabajo. Sin ISR ni carga patronal.">
          <dl className="divide-y text-sm">
            {[
              [t("Salario semanal"), formatMoney(b.weeklySalary)],
              [t("Jornada"), t("{v0} días ({v1}) · {v2} h por día", { v0: e.workDays, v1: e.workDays === 5 ? "descansa fin de semana" : "descansa domingo", v2: formatNumber(e.hoursPerDay) })],
              [t("Salario diario"), `${formatMoney(b.weeklySalary)} ÷ ${e.workDays} = ${formatMoney(rates.daily)}`],
              [t("Salario por hora"), `${formatMoney(rates.daily)} ÷ ${formatNumber(e.hoursPerDay)} = ${formatMoney(rates.hourly)}`],
              [t("Salario mensual promedio"), t("{v0} (6 días × 52 semanas ÷ 12)", { v0: formatMoney(b.monthlySalary) })],
              [t("Vacaciones del periodo actual"), s.years >= 1 ? t("{v0} días (desde {v1})", { v0: b.vacationEntitled, v1: formatDate(s.lastAnniversary) }) : t("Aún no cumple 1 año")],
              [t("Vacaciones acumuladas hacia el próximo aniversario"), t("{v0} de {v1} días", { v0: formatNumber(b.vacationAccrued), v1: b.nextEntitlement })],
              [t("Prima vacacional (25%)"), t("{v0} por día · {v1} por los días disponibles", { v0: formatMoney(b.vacationPremiumPerDay), v1: formatMoney(b.vacationPremiumAvailable) })],
              [t("Aguinaldo {v0} ({v1} días por antigüedad)", { v0: new Date().getFullYear(), v1: b.aguinaldoDays }), t("{v0} a hoy · {v1} al corte del 20 de diciembre", { v0: formatMoney(b.aguinaldoToDate), v1: formatMoney(b.aguinaldoYear) })],
              ...(absent
                ? [[t("Faltas injustificadas descontadas del aguinaldo"), t("{v0} día(s) no cuentan como trabajados (incluye descansos por retardos)", { v0: formatNumber(absent) })]]
                : []),
              [
                t("Días de aguinaldo a pagar"),
                b.aguinaldoRawDays === b.aguinaldoPayDays
                  ? t("{v0} días (proporcional, con decimales)", { v0: formatNumber(b.aguinaldoPayDays) })
                  : t("{v0} proporcionales → {v1} días (con ,6 o más sube al siguiente)", { v0: formatNumber(b.aguinaldoRawDays), v1: formatNumber(b.aguinaldoPayDays) }),
              ],
              [t("Bono fijo semanal"), formatMoney(e.weeklyBonus)],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t px-5 py-3 text-xs text-muted-foreground">
            <div><Tr>Vacaciones (LFT):</Tr> {[1, 2, 3, 4, 5, 6, 11, 16].map((y) => `${y}${y >= 6 ? "+" : ""} año${y === 1 ? "" : "s"}: ${vacationDaysFor(y)}`).join(" · ")}</div>
            <div className="mt-1">
              <Tr>Aguinaldo:</Tr> {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((y) => `${y === 0 ? "1er año" : `${y} año${y === 1 ? "" : "s"}`}: ${aguinaldoDaysFor(y)}`).join(" · ")} <Tr>(tope 30 días)</Tr>
            </div>
          </div>
        </Panel>

        <Panel title="Historial de nómina">
          {e.payrollLines.length === 0 ? (
            <Empty><Tr>Sin nóminas registradas.</Tr></Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th><Tr>Periodo</Tr></th>
                    <th className="text-right"><Tr>Días</Tr></th>
                    <th className="text-right"><Tr>Vac.</Tr></th>
                    <th className="text-right"><Tr>Neto</Tr></th>
                    <th className="w-10">
                      <span className="sr-only"><Tr>Recibo</Tr></span>
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
                        {l.run.status === "BORRADOR" && <span className="ml-2 text-xs text-amber-700"><Tr>borrador</Tr></span>}
                        {l.run.status === "APROBADA" && <span className="ml-2 text-xs text-sky-700">{l.paidAt ? <Tr>pagado</Tr> : <Tr>por pagar</Tr>}</span>}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatNumber(l.days - l.absences - l.leaveDays)}
                        {l.absences > 0 && <span className="text-xs text-rose-600"> ({formatNumber(l.absences)} <Tr>faltas)</Tr></span>}
                        {l.leaveDays > 0 && <span className="text-xs text-sky-700"> ({formatNumber(l.leaveDays)} <Tr>sin goce)</Tr></span>}
                      </td>
                      <td className="text-right tabular-nums">{l.vacationDays ? formatNumber(l.vacationDays) : "—"}</td>
                      <td className="text-right font-medium tabular-nums">{formatMoney(l.net)}</td>
                      <td className="py-1 text-right">
                        <PdfLink href={`/api/pdf/nomina/${l.runId}?linea=${l.id}`} label={t("Recibo de nómina")} />
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
        <EmployeeIncidents e={e} unjustifiedYear={absent} />
      </div>

      <div className="mb-6">
        <EmployeeKiosk e={e} />
      </div>

      <h2 className="mb-3 font-semibold"><Tr>Datos del empleado</Tr></h2>
      <EmployeeForm action={updateEmployee.bind(null, e.id)} e={e} />
    </div>
  );
}
