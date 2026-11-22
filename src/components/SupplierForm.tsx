import type { Supplier } from "@prisma/client";
import { Field } from "./kit";
import { SubmitButton } from "./SubmitButton";
import { Form } from "./Form";
import { Tr } from "@/components/Tr";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { getT } from "@/lib/i18n/server";

/** Alta y edición de proveedor: datos fiscales, contacto, condiciones y datos bancarios para pagarle. */
export async function SupplierForm({ action, supplier }: { action: (fd: FormData) => Promise<unknown>; supplier?: Supplier }) {
  const t = await getT();
  const categories = EXPENSE_CATEGORIES.filter((c) => c !== "Nómina" && c !== "Impuestos");
  return (
    <Form action={action} successMessage={supplier ? "Cambios guardados." : undefined} className="card divide-y">
      <section className="grid gap-4 p-5 md:grid-cols-3">
        <h3 className="text-sm font-semibold md:col-span-3">{t("Datos fiscales")}</h3>
        <Field label="Nombre comercial *" className="md:col-span-2">
          <input name="name" required defaultValue={supplier?.name} className="input" />
        </Field>
        <Field label="RFC">
          <input name="rfc" defaultValue={supplier?.rfc} className="input uppercase" maxLength={13} />
        </Field>
        <Field label="Razón social" className="md:col-span-2">
          <input name="legalName" defaultValue={supplier?.legalName} className="input" />
        </Field>
        <Field label="Giro" hint="Categoría de gasto que se propone al registrarle un egreso.">
          <select name="category" defaultValue={supplier?.category ?? ""} className="input">
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dirección" className="md:col-span-3">
          <input name="address" defaultValue={supplier?.address} className="input" />
        </Field>
      </section>

      <section className="grid gap-4 p-5 md:grid-cols-3">
        <h3 className="text-sm font-semibold md:col-span-3">{t("Contacto")}</h3>
        <Field label="Contacto">
          <input name="contactName" defaultValue={supplier?.contactName} className="input" />
        </Field>
        <Field label="Correo">
          <input name="email" type="email" defaultValue={supplier?.email} className="input" />
        </Field>
        <Field label="Teléfono">
          <input name="phone" type="tel" defaultValue={supplier?.phone} className="input" />
        </Field>
        <Field label="Sitio web" className="md:col-span-3">
          <input name="website" defaultValue={supplier?.website} className="input" placeholder="proveedor.com" />
        </Field>
      </section>

      <section className="grid gap-4 p-5 md:grid-cols-3">
        <h3 className="text-sm font-semibold md:col-span-3">{t("Pago")}</h3>
        <Field label="Días de crédito" hint="0 = pago de contado.">
          <input name="creditDays" type="number" min={0} max={365} step={1} defaultValue={supplier?.creditDays ?? 0} className="input tabular-nums" />
        </Field>
        <Field label="Banco">
          <input name="bank" defaultValue={supplier?.bank} className="input" />
        </Field>
        <Field label="Número de cuenta">
          <input name="accountNumber" defaultValue={supplier?.accountNumber} className="input tabular-nums" />
        </Field>
        <Field label="CLABE" className="md:col-span-2" hint="18 dígitos.">
          <input name="clabe" defaultValue={supplier?.clabe} inputMode="numeric" maxLength={22} className="input font-mono tabular-nums" />
        </Field>
      </section>

      <div className="space-y-4 p-5">
        <Field label="Notas internas">
          <textarea name="notes" rows={3} defaultValue={supplier?.notes} className="input" />
        </Field>
        <div className="flex items-center justify-between">
          {supplier ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={supplier.active} /> <Tr>Proveedor activo</Tr>
            </label>
          ) : (
            <span />
          )}
          <SubmitButton>{supplier ? t("Guardar cambios") : t("Crear proveedor")}</SubmitButton>
        </div>
      </div>
    </Form>
  );
}
