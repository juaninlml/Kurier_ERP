import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, RotateCcw, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { deletePayrollRun, payPayrollRun, reopenPayrollRun, savePayrollRun } from "@/app/actions/payroll";
import { PageHeader } from "@/components/kit";
import { Form } from "@/components/Form";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PayrollEditor } from "@/components/PayrollEditor";
import { Badge } from "@/components/ui/badge";
import { benefits, overtimeHoursFrom, seniority } from "@/lib/payroll";
import { brandOptions } from "@/lib/brands";
import { jobCatalog, vacationTakenMap } from "@/lib/payroll-data";
import { formatDate, formatMoney, toInputDate } from "@/lib/money";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const id = Number((await params).id);
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { lines: { include: { employee: true }, orderBy: { employee: { name: "asc" } } } },
  });
  if (!run) notFound();
  const [brands, cfg, catalog] = await Promise.all([
    brandOptions(),
    prisma.companySettings.findUnique({ where: { id: 1 }, select: { overtimeRate: true } }),
    jobCatalog(),
  ]);
  const overtimeRate = cfg?.overtimeRate ?? 2;
  const payer = brands.find((b) => b.id === (run.brandId ?? 0))?.name.replace(/ \(principal\)$/, "") ?? "";
  const paid = run.status === "PAGADA";
  const employees = run.lines.map((l) => l.employee);
  const taken = await vacationTakenMap(employees, run.payDate);

  const lines = run.lines.map((l) => {
    // Vacaciones disponibles sin contar lo capturado en esta misma nómina
    const inPeriod = run.periodStart >= seniority(l.employee.startDate, run.payDate).lastAnniversary;
    const b = benefits(l.employee, (taken.get(l.employeeId) ?? 0) - (inPeriod ? l.vacationDays : 0), run.payDate);
    return {
      id: l.id,
      employeeId: l.employeeId,
      name: l.employee.name,
      position: l.employee.position,
      area: l.employee.area,
      department: l.employee.department,
      weeklySalary: l.weeklySalary || l.dailySalary * l.workDays,
      workDays: l.workDays === 5 ? 5 : 6,
      hoursPerDay: l.hoursPerDay,
      days: l.days,
      absences: l.absences,
      vacationDays: l.vacationDays,
      // Nóminas anteriores solo tenían el importe: se convierte a horas con la tarifa actual
      overtimeHours: l.overtimeHours || overtimeHoursFrom(l.overtime, l.weeklySalary || l.dailySalary * l.workDays, l.workDays, l.hoursPerDay, overtimeRate),
      bonus: l.bonus,
      bonusNote: l.bonusNote,
      aguinaldo: l.aguinaldo,
      otherIncome: l.otherIncome,
      deductions: l.deductions,
      deductionNote: l.deductionNote,
      notes: l.notes,
      vacationAvailable: b.vacationAvailable,
      // Aguinaldo a pagar al corte del 20 de diciembre (días redondeados)
      aguinaldoDue: b.aguinaldoYear,
    };
  });

  return (
    <div>
      <PageHeader
        title={t("Nómina del {v0} al {v1}", { v0: formatDate(run.periodStart), v1: formatDate(run.periodEnd) })}
        back={{ href: "/nomina", label: t("Nómina") }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={paid ? "border-transparent bg-emerald-50 text-emerald-700" : "border-transparent bg-amber-50 text-amber-800"}>
              {paid ? t("Pagada") : t("Borrador")}
            </Badge>
            {run.lines.length} <Tr>empleado(s) · Pago</Tr> {formatDate(run.payDate)} <Tr>· Total</Tr> {formatMoney(run.total)}
            {payer && (
              <span>
                · <Tr>Paga</Tr> <span className="font-medium text-foreground">{payer}</span>
              </span>
            )}
            {paid && run.transactionId && (
              <Link href={`/contabilidad/movimientos/${run.transactionId}`} className="text-primary hover:underline">
                <Tr>Ver egreso en contabilidad</Tr>
              </Link>
            )}
          </span>
        }
        actions={
          paid ? (
            <Form action={reopenPayrollRun.bind(null, run.id)}>
              <ConfirmButton message={t("¿Regresar la nómina a borrador? Se eliminará el egreso registrado en contabilidad.")} className="btn-secondary">
                <RotateCcw className="size-4" /> <Tr>Regresar a borrador</Tr>
              </ConfirmButton>
            </Form>
          ) : (
            <>
              <Form action={deletePayrollRun.bind(null, run.id)}>
                <ConfirmButton message={t("¿Eliminar esta nómina?")} className="btn-danger">
                  <Trash2 className="size-4" /> <Tr>Eliminar</Tr>
                </ConfirmButton>
              </Form>
              <Form action={payPayrollRun.bind(null, run.id)}>
                <ConfirmButton
                  message={t("¿Marcar como pagada? Se registrará un egreso de {v0} en contabilidad (categoría Nómina). Guarda antes los cambios pendientes.", { v0: formatMoney(run.total) })}
                  className="btn-kurier"
                >
                  <BadgeCheck className="size-4" /> <Tr>Marcar como pagada</Tr>
                </ConfirmButton>
              </Form>
            </>
          )
        }
      />
      <PayrollEditor action={savePayrollRun.bind(null, run.id)} runId={run.id} lines={lines} payDate={toInputDate(run.payDate)} notes={run.notes} readOnly={paid} overtimeRate={overtimeRate} brands={brands} brandId={run.brandId ?? 0} catalog={catalog} />
    </div>
  );
}
