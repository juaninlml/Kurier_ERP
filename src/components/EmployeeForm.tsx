import type { Employee } from "@prisma/client";
import { Field } from "./kit";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { toInputDate } from "@/lib/money";
import { SalaryFields } from "./SalaryFields";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export async function EmployeeForm({ action, e }: { action: (fd: FormData) => Promise<unknown>; e?: Employee }) {
  const t = await getT();
  return (
    <Form action={action} successMessage={e ? "Cambios guardados." : undefined} className="card space-y-6 p-5">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold"><Tr>Datos laborales</Tr></h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Nombre completo *" className="md:col-span-2">
            <input name="name" required defaultValue={e?.name} className="input" />
          </Field>
          <Field label="Puesto">
            <input name="position" defaultValue={e?.position} className="input" placeholder={t("Auxiliar de almacén")} />
          </Field>
          <Field label="Área">
            <input name="area" list="areas" defaultValue={e?.area} className="input" placeholder={t("Almacén")} />
            <datalist id="areas">
              {[t("Almacén"), t("Última milla"), t("Administración"), t("Atención a clientes"), t("Dirección")].map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
          <Field label="Fecha de ingreso *" hint="Base para antigüedad, vacaciones y aguinaldo">
            <input name="startDate" type="date" required defaultValue={e ? toInputDate(e.startDate) : undefined} className="input" />
          </Field>
          <Field label="Fecha de baja" hint="Déjala vacía si sigue activo">
            <input name="endDate" type="date" defaultValue={e?.endDate ? toInputDate(e.endDate) : undefined} className="input" />
          </Field>
          <SalaryFields weekly={e ? e.weeklySalary || e.dailySalary * e.workDays : undefined} workDays={e?.workDays} hoursPerDay={e?.hoursPerDay} weeklyBonus={e?.weeklyBonus} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold"><Tr>Horario (kiosco de asistencia)</Tr></h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Field label="Entrada">
            <input name="scheduleStart" type="time" required defaultValue={e?.scheduleStart ?? "09:00"} className="input" />
          </Field>
          <Field label="Salida" hint="5 min después se registra la salida automática si no tiene horas extra autorizadas">
            <input name="scheduleEnd" type="time" required defaultValue={e?.scheduleEnd ?? "18:00"} className="input" />
          </Field>
          <Field label="Comida desde">
            <input name="mealStart" type="time" required defaultValue={e?.mealStart ?? "14:00"} className="input" />
          </Field>
          <Field label="Comida hasta">
            <input name="mealEnd" type="time" required defaultValue={e?.mealEnd ?? "15:00"} className="input" />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold"><Tr>Datos personales y de pago</Tr></h3>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="RFC">
            <input name="rfc" defaultValue={e?.rfc} className="input uppercase" />
          </Field>
          <Field label="CURP">
            <input name="curp" defaultValue={e?.curp} className="input uppercase" />
          </Field>
          <Field label="NSS">
            <input name="nss" defaultValue={e?.nss} className="input" />
          </Field>
          <Field label="Teléfono">
            <input name="phone" defaultValue={e?.phone} className="input" />
          </Field>
          <Field label="Correo">
            <input name="email" type="email" defaultValue={e?.email} className="input" />
          </Field>
          <Field label="Banco">
            <input name="bankName" defaultValue={e?.bankName} className="input" />
          </Field>
          <Field label="CLABE / cuenta" className="md:col-span-1">
            <input name="clabe" defaultValue={e?.clabe} className="input font-mono" />
          </Field>
          <Field label="Domicilio" className="md:col-span-2">
            <input name="address" defaultValue={e?.address} className="input" />
          </Field>
          <Field label="Notas" className="md:col-span-3">
            <textarea name="notes" rows={2} defaultValue={e?.notes} className="input" />
          </Field>
        </div>
      </section>

      <div className="flex items-center justify-between">
        {e ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={e.active} /> <Tr>Empleado activo</Tr>
          </label>
        ) : (
          <span />
        )}
        <SubmitButton>{e ? t("Guardar cambios") : t("Dar de alta")}</SubmitButton>
      </div>
    </Form>
  );
}
