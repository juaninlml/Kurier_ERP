import { createEmployee } from "@/app/actions/payroll";
import { EmployeeForm } from "@/components/EmployeeForm";
import { PageHeader } from "@/components/kit";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Nuevo empleado") };
}

export default function NewEmployeePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nuevo empleado" back={{ href: "/nomina", label: "Nómina" }} />
      <EmployeeForm action={createEmployee} />
    </div>
  );
}
