import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { updateService } from "@/app/actions/services";
import { PageHeader, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { UNITS } from "@/lib/constants";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const sv = await prisma.service.findUnique({ where: { id: Number((await params).id) } });
  if (!sv) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={sv.name} subtitle={sv.code} back={{ href: "/servicios", label: "Servicios" }} />
      <form action={updateService.bind(null, sv.id)} className="card space-y-4 p-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Clave *">
            <input name="code" required defaultValue={sv.code} className="input uppercase" />
          </Field>
          <Field label="Unidad">
            <input name="unit" list="units-list" defaultValue={sv.unit} className="input" />
          </Field>
        </div>
        <Field label="Nombre *">
          <input name="name" required defaultValue={sv.name} className="input" />
        </Field>
        <Field label="Descripción">
          <textarea name="description" rows={3} defaultValue={sv.description} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Precio unitario">
            <input name="unitPrice" type="number" step="0.01" min="0" defaultValue={sv.unitPrice} className="input" />
          </Field>
          <Field label="IVA %">
            <input name="taxRate" type="number" step="any" min="0" defaultValue={sv.taxRate} className="input" />
          </Field>
        </div>
        <datalist id="units-list">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={sv.active} /> Activo
          </label>
          <SubmitButton>Guardar</SubmitButton>
        </div>
      </form>
    </div>
  );
}
