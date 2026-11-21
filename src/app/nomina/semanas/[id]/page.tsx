import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarSync, RotateCcw, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { approvePayrollRun, deletePayrollRun, refreshPayrollIncidents, reopenPayrollRun, savePayrollRun } from "@/app/actions/payroll";
import { PayrollPayments } from "@/components/PayrollPayments";
import { groupByOrg } from "@/lib/org";
import { canManageUsers, getCurrentUser } from "@/lib/current-user";
import { PageHeader } from "@/components/kit";
import { Form } from "@/components/Form";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PayrollEditor } from "@/components/PayrollEditor";
import { Badge } from "@/components/ui/badge";
import { benefits, overtimeHoursFrom, payMethodOf, seniority } from "@/lib/payroll";
import { brandOptions } from "@/lib/brands";
import { jobCatalog, unjustifiedMap, vacationTakenMap } from "@/lib/payroll-data";
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
  const draft = run.status === "BORRADOR";
  const isAdmin = canManageUsers((await getCurrentUser()).role);
  const STATUS: Record<string, [string, string]> = {
    BORRADOR: [t("Borrador"), "bg-amber-50 text-amber-800"],
    APROBADA: [t("Aprobada"), "bg-sky-50 text-sky-800"],
    PAGADA: [t("Pagada"), "bg-emerald-50 text-emerald-700"],
  };
  const [statusLabel, statusCls] = STATUS[run.status] ?? STATUS.BORRADOR;
  const employees = run.lines.map((l) => l.employee);
  const [taken, absent] = await Promise.all([vacationTakenMap(employees, run.payDate), unjustifiedMap(employees.map((e) => e.id), run.payDate.getUTCFullYear())]);

  const lines = run.lines.map((l) => {
    // Vacaciones disponibles sin contar lo capturado en esta misma nómina
    const inPeriod = run.periodStart >= seniority(l.employee.startDate, run.payDate).lastAnniversary;
    const b = benefits(l.employee, (taken.get(l.employeeId) ?? 0) - (inPeriod ? l.vacationDays : 0), run.payDate, absent.get(l.employeeId) ?? 0);
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
      leaveDays: l.leaveDays,
      vacationDays: l.vacationDays,
      absenceNote: l.absenceNote,
      notice: l.notice,
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
            <Badge variant="outline" className={`border-transparent ${statusCls}`}>{statusLabel}</Badge>
            {run.approvedBy && !draft && (
              <span>
                <Tr>Aprobó</Tr> {run.approvedBy} ·
              </span>
            )}
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
          !draft ? (
            isAdmin && (
              <Form action={reopenPayrollRun.bind(null, run.id)}>
                <ConfirmButton
                  message={
                    paid
                      ? t("¿Regresar la nómina a borrador? Se quitarán las marcas de pago y se eliminará el egreso registrado en contabilidad.")
                      : t("¿Regresar la nómina a borrador para editarla? Se quitarán las marcas de pago.")
                  }
                  className="btn-secondary"
                >
                  <RotateCcw className="size-4" /> <Tr>Regresar a borrador</Tr>
                </ConfirmButton>
              </Form>
            )
          ) : (
            <>
              <Form action={refreshPayrollIncidents.bind(null, run.id)}>
                <ConfirmButton
                  message={t("¿Actualizar faltas, permisos, vacaciones y descansos por retardos con las incidencias registradas? Guarda antes los cambios pendientes.")}
                  className="btn-secondary"
                >
                  <CalendarSync className="size-4" /> <Tr>Actualizar incidencias</Tr>
                </ConfirmButton>
              </Form>
              <Form action={deletePayrollRun.bind(null, run.id)}>
                <ConfirmButton message={t("¿Eliminar esta nómina?")} className="btn-danger">
                  <Trash2 className="size-4" /> <Tr>Eliminar</Tr>
                </ConfirmButton>
              </Form>
              {isAdmin && (
                <Form action={approvePayrollRun.bind(null, run.id)}>
                  <ConfirmButton
                    message={t("¿Aprobar la nómina por {v0}? Ya no se podrá editar y pasa a pagos: quien paga marca a cada empleado. Guarda antes los cambios pendientes.", { v0: formatMoney(run.total) })}
                    className="btn-kurier"
                  >
                    <BadgeCheck className="size-4" /> <Tr>Aprobar nómina</Tr>
                  </ConfirmButton>
                </Form>
              )}
            </>
          )
        }
      />
      {draft ? (
        /* key: al actualizar incidencias (o guardar) el editor se vuelve a montar con los datos nuevos */
        <PayrollEditor key={run.updatedAt.getTime()} action={savePayrollRun.bind(null, run.id)} runId={run.id} lines={lines} payDate={toInputDate(run.payDate)} notes={run.notes} readOnly={false} overtimeRate={overtimeRate} brands={brands} brandId={run.brandId ?? 0} catalog={catalog} />
      ) : (
        <div className="space-y-6">
          {/* Aprobada / pagada: solo el neto de cada empleado, en el orden de la nómina (área › departamento) */}
          <PayrollPayments
            status={run.status}
            total={run.total}
            rows={groupByOrg(run.lines, (l) => l.employee, catalog)
              .flatMap((g) => g.departments.flatMap((d) => d.items))
              .map((l) => ({
                id: l.id,
                name: l.employee.name,
                area: [l.employee.area, l.employee.department].filter(Boolean).join(" › "),
                position: l.employee.position,
                bank: l.employee.bankName,
                clabe: l.employee.clabe,
                net: l.net,
                method: payMethodOf(l, l.employee),
                // Para quien paga: motivos de bono y descuento y comentarios capturados (no el resumen automático de asistencia)
                comments: [l.bonus > 0 && l.bonusNote, l.deductions > 0 && l.deductionNote, !l.notes.startsWith("Asistencia:") && l.notes].filter(Boolean).join(" · "),
                paidAt: l.paidAt ? l.paidAt.toISOString() : null,
                paidBy: l.paidBy,
              }))}
          />
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              <Tr>Ver desglose de la nómina</Tr>
            </summary>
            <div className="mt-4">
              <PayrollEditor action={savePayrollRun.bind(null, run.id)} runId={run.id} lines={lines} payDate={toInputDate(run.payDate)} notes={run.notes} readOnly overtimeRate={overtimeRate} brands={brands} brandId={run.brandId ?? 0} catalog={catalog} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
