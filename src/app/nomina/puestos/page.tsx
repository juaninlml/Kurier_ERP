import { Plus, Save, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { createJobPosition, deleteJobPosition, updateJobPosition } from "@/app/actions/payroll";
import { PageHeader, Panel, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { jobCatalog } from "@/lib/payroll-data";
import { groupByOrg } from "@/lib/org";
import { getT } from "@/lib/i18n/server";
import { Tr } from "@/components/Tr";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await getT())("Puestos") };
}

export default async function JobPositionsPage() {
  const t = await getT();
  const [catalog, counts] = await Promise.all([
    jobCatalog(),
    prisma.employee.groupBy({
      by: ["jobPositionId"],
      where: { active: true, jobPositionId: { not: null } },
      _count: true,
    }),
  ]);
  const people = new Map(counts.map((c) => [c.jobPositionId, c._count]));
  const groups = groupByOrg(catalog, (p) => p, catalog);
  const areas = [...new Set([...catalog.map((p) => p.area), "Almacén", "Administración"])];
  const departments = [...new Set(catalog.map((p) => p.department).filter(Boolean))];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("Puestos")}
        back={{ href: "/nomina", label: t("Nómina") }}
        subtitle={t(
          "Cada puesto pertenece a un departamento dentro de un área. Al elegir el puesto de un empleado, su área y departamento se llenan solos y la nómina se agrupa con ellos.",
        )}
      />

      <datalist id="org-areas">
        {areas.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <datalist id="org-departments">
        {departments.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      <Panel title={t("Nuevo puesto")} className="mb-6">
        <Form action={createJobPosition} resetOnSuccess className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
          <Field label="Área *">
            <input name="area" list="org-areas" required className="input" placeholder={t("Almacén")} />
          </Field>
          <Field label="Departamento">
            <input name="department" list="org-departments" className="input" placeholder={t("Picking")} />
          </Field>
          <Field label="Puesto *">
            <input name="name" required className="input" placeholder={t("Auxiliar picking")} />
          </Field>
          <SubmitButton className="btn-primary" pendingText={t("Agregando…")}>
            <Plus className="size-4" /> <Tr>Agregar</Tr>
          </SubmitButton>
        </Form>
      </Panel>

      <div className="space-y-6">
        {groups.map((g) => (
          <Panel key={g.area} title={g.area} description={t("{v0} puesto(s)", { v0: g.count })}>
            <div className="divide-y">
              {g.departments.map((d) => (
                <div key={d.department} className="px-5 py-4">
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{d.department || t("Sin departamento")}</h3>
                  <ul className="space-y-2">
                    {d.items.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-2">
                        <Form
                          action={updateJobPosition.bind(null, p.id)}
                          successMessage="Puesto actualizado."
                          className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-center"
                        >
                          <input name="area" list="org-areas" required defaultValue={p.area} aria-label={t("Área")} className="input h-9" />
                          <input name="department" list="org-departments" defaultValue={p.department} aria-label={t("Departamento")} className="input h-9" />
                          <input name="name" required defaultValue={p.name} aria-label={t("Puesto")} className="input h-9 font-medium" />
                          <SubmitButton className="btn-secondary h-9" pendingText="…">
                            <Save className="size-4" /> <Tr>Guardar</Tr>
                          </SubmitButton>
                        </Form>
                        <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">
                          {t("{v0} empleado(s)", { v0: people.get(p.id) ?? 0 })}
                        </span>
                        <Form action={deleteJobPosition.bind(null, p.id)}>
                          <ConfirmButton
                            message={t("¿Eliminar el puesto {v0}?", {
                              v0: p.name,
                            })}
                            className="btn-secondary h-9 px-2.5 text-rose-700"
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">
                              <Tr>Eliminar</Tr>
                            </span>
                          </ConfirmButton>
                        </Form>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
