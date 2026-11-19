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
import { benefits, seniority } from "@/lib/payroll";
import { vacationTakenMap } from "@/lib/payroll-data";
import { formatDate, formatMoney, toInputDate } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { lines: { include: { employee: true }, orderBy: { employee: { name: "asc" } } } },
  });
  if (!run) notFound();
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
      weeklySalary: l.weeklySalary || l.dailySalary * l.workDays,
      workDays: l.workDays === 5 ? 5 : 6,
      hoursPerDay: l.hoursPerDay,
      days: l.days,
      absences: l.absences,
      vacationDays: l.vacationDays,
      overtime: l.overtime,
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
        title={`Nómina del ${formatDate(run.periodStart)} al ${formatDate(run.periodEnd)}`}
        back={{ href: "/nomina", label: "Nómina" }}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={paid ? "border-transparent bg-emerald-50 text-emerald-700" : "border-transparent bg-amber-50 text-amber-800"}>
              {paid ? "Pagada" : "Borrador"}
            </Badge>
            {run.lines.length} empleado(s) · Pago {formatDate(run.payDate)} · Total {formatMoney(run.total)}
            {paid && run.transactionId && (
              <Link href={`/contabilidad/movimientos/${run.transactionId}`} className="text-primary hover:underline">
                Ver egreso en contabilidad
              </Link>
            )}
          </span>
        }
        actions={
          paid ? (
            <Form action={reopenPayrollRun.bind(null, run.id)}>
              <ConfirmButton message="¿Regresar la nómina a borrador? Se eliminará el egreso registrado en contabilidad." className="btn-secondary">
                <RotateCcw className="size-4" /> Regresar a borrador
              </ConfirmButton>
            </Form>
          ) : (
            <>
              <Form action={deletePayrollRun.bind(null, run.id)}>
                <ConfirmButton message="¿Eliminar esta nómina?" className="btn-danger">
                  <Trash2 className="size-4" /> Eliminar
                </ConfirmButton>
              </Form>
              <Form action={payPayrollRun.bind(null, run.id)}>
                <ConfirmButton
                  message={`¿Marcar como pagada? Se registrará un egreso de ${formatMoney(run.total)} en contabilidad (categoría Nómina). Guarda antes los cambios pendientes.`}
                  className="btn-kurier"
                >
                  <BadgeCheck className="size-4" /> Marcar como pagada
                </ConfirmButton>
              </Form>
            </>
          )
        }
      />
      <PayrollEditor action={savePayrollRun.bind(null, run.id)} runId={run.id} lines={lines} payDate={toInputDate(run.payDate)} notes={run.notes} readOnly={paid} />
    </div>
  );
}
