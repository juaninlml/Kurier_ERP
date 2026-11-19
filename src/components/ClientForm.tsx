import type { Client } from "@prisma/client";
import { Field } from "./kit";
import { SubmitButton } from "./SubmitButton";
import { Form } from "./Form";

export function ClientForm({
  action,
  client,
  brands = [],
}: {
  action: (fd: FormData) => Promise<unknown>;
  client?: Client;
  /** Marcas que pueden facturarle (id 0 = la principal). Con una sola no se muestra. */
  brands?: { id: number; name: string }[];
}) {
  return (
    <Form action={action} successMessage={client ? "Cambios guardados." : undefined} className="card space-y-4 p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Nombre / Marca *" className="md:col-span-2">
          <input name="name" required defaultValue={client?.name} className="input" />
        </Field>
        <Field label="RFC">
          <input name="rfc" defaultValue={client?.rfc} className="input uppercase" />
        </Field>
        <Field label="Razón social" className="md:col-span-3">
          <input name="legalName" defaultValue={client?.legalName} className="input" />
        </Field>
        <Field label="Contacto">
          <input name="contactName" defaultValue={client?.contactName} className="input" />
        </Field>
        <Field label="Correo">
          <input name="email" type="email" defaultValue={client?.email} className="input" />
        </Field>
        <Field label="Teléfono">
          <input name="phone" defaultValue={client?.phone} className="input" />
        </Field>
        <Field label="Dirección" className="md:col-span-3">
          <input name="address" defaultValue={client?.address} className="input" />
        </Field>
        {brands.length > 1 && (
          <Field label="Marca que le factura" className="md:col-span-3" hint="Sus cotizaciones, facturas, estados de cuenta y resúmenes salen con los datos y el logo de esta marca.">
            <select name="brandId" defaultValue={client?.brandId ?? 0} className="input md:max-w-sm">
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {brands.length <= 1 && client?.brandId ? <input type="hidden" name="brandId" value={client.brandId} /> : null}
        <Field label="Nombre en el WMS" hint="Como aparece en los estados de cobro del WMS (ej. Basic&Pure). Sirve para reconocer al cliente al importar.">
          <input name="wmsName" defaultValue={client?.wmsName} className="input" placeholder="Basic&Pure" />
        </Field>
        <Field label="Notas internas" className="md:col-span-2">
          <textarea name="notes" rows={3} defaultValue={client?.notes} className="input" />
        </Field>
      </div>
      <div className="flex items-center justify-between">
        {client ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={client.active} /> Cliente activo
          </label>
        ) : (
          <span />
        )}
        <SubmitButton>{client ? "Guardar cambios" : "Crear cliente"}</SubmitButton>
      </div>
    </Form>
  );
}
