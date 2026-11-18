import type { TariffTable } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { createTariffTable, deleteTariffTable, saveTariffTexts, updateTariffTable } from "@/app/actions/tariff";
import { PageHeader, Field } from "@/components/ui";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function TariffTablesPage() {
  const [tables, sections, s] = await Promise.all([
    prisma.tariffTable.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.serviceSection.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  const sectionNames = sections.map((x) => x.name);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="PDF del tarifario"
        subtitle="Textos y tablas informativas que acompañan a los servicios en el PDF del tarifario (y, si lo marcas, en las cotizaciones)."
        back={{ href: "/servicios", label: "Tarifario" }}
        actions={
          <>
            <a href="/api/pdf/tarifario" target="_blank" className="btn-secondary">
              Ver PDF
            </a>
            <a href="/api/pdf/tarifario?download" className="btn-primary">
              Descargar
            </a>
          </>
        }
      />

      <Form action={saveTariffTexts} className="card mb-6 space-y-4 p-5">
        <h2 className="font-semibold">Textos del tarifario</h2>
        <Field label="Introducción (bajo el título)">
          <textarea name="tariffIntro" rows={2} defaultValue={s.tariffIntro} className="input" />
        </Field>
        <Field label="Condiciones comerciales (una por línea; “Título: texto”). Vacío = se usan las de cotización">
          <textarea name="tariffTerms" rows={8} defaultValue={s.tariffTerms} className="input" />
        </Field>
        <Field label="Recuadro final">
          <textarea name="tariffClosing" rows={2} defaultValue={s.tariffClosing} className="input" />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Guardar textos</SubmitButton>
        </div>
      </Form>

      <h2 className="mb-1 font-semibold">Tablas informativas</h2>
      <p className="mb-4 text-xs text-slate-500">
        Columnas separadas por <code>|</code>, con ancho opcional en % (<code>Concepto:32|Detalle:68</code>). Filas: una por línea, celdas separadas por{" "}
        <code>|</code>. Deja la primera celda vacía para continuar un grupo (ej. zonas). Admite <code>**negritas**</code> en la nota.
      </p>
      <div className="space-y-4">
        {tables.map((t) => (
          <div key={t.id} className="card p-5">
            <Form action={updateTariffTable.bind(null, t.id)} className="space-y-3">
              <TableFields t={t} sections={sectionNames} />
              <div className="flex justify-end">
                <SubmitButton className="btn-secondary">Guardar tabla</SubmitButton>
              </div>
            </Form>
            <Form action={deleteTariffTable.bind(null, t.id)} className="mt-2 w-fit">
              <ConfirmButton message={`¿Eliminar la tabla “${t.title}”?`} className="btn-danger text-xs">
                Eliminar
              </ConfirmButton>
            </Form>
          </div>
        ))}

        <Form action={createTariffTable} className="card space-y-3 border-dashed p-5">
          <h3 className="font-semibold">Nueva tabla</h3>
          <TableFields sections={sectionNames} />
          <div className="flex justify-end">
            <SubmitButton>Agregar tabla</SubmitButton>
          </div>
        </Form>
      </div>
    </div>
  );
}

function TableFields({ t, sections }: { t?: TariffTable; sections: string[] }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_90px]">
        <Field label="Título *">
          <input name="title" required defaultValue={t?.title} className="input font-medium" placeholder="Niveles de servicio (SLA)" />
        </Field>
        <Field label="Va después de la sección">
          <select name="afterSection" defaultValue={t?.afterSection ?? ""} className="input">
            <option value="">Al final del tarifario</option>
            {sections.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Orden">
          <input name="sortOrder" type="number" step="1" defaultValue={t?.sortOrder ?? 0} className="input" />
        </Field>
      </div>
      <Field label="Columnas">
        <input name="columns" defaultValue={t?.columns ?? "Concepto:32|Detalle:68"} className="input font-mono text-xs" />
      </Field>
      <Field label="Filas">
        <textarea name="rows" rows={Math.min(14, Math.max(3, (t?.rows.split("\n").length ?? 2) + 1))} defaultValue={t?.rows} className="input font-mono text-xs" />
      </Field>
      <Field label="Nota bajo la tabla (opcional)">
        <textarea name="note" rows={2} defaultValue={t?.note} className="input text-xs" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="inQuotes" defaultChecked={t?.inQuotes} /> Imprimir también en las cotizaciones (antes de las condiciones comerciales)
      </label>
    </>
  );
}
