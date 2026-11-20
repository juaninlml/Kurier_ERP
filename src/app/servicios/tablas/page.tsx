import { Download, Eye, Trash2 } from "lucide-react";
import type { TariffTable } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { createTariffTable, deleteTariffTable, saveTariffTexts, updateTariffTable } from "@/app/actions/tariff";
import { PageHeader, Field } from "@/components/kit";
import { Form } from "@/components/Form";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Tr } from "@/components/Tr";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function TariffTablesPage() {
  const tr = await getT();
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
        back={{ href: "/servicios", label: tr("Tarifario") }}
        actions={
          <>
            <a href="/api/pdf/tarifario" target="_blank" className="btn-secondary">
              <Eye className="size-4" /> <Tr>Ver PDF</Tr>
            </a>
            <a href="/api/pdf/tarifario?download" className="btn-primary">
              <Download className="size-4" /> <Tr>Descargar</Tr>
            </a>
          </>
        }
      />

      <Form action={saveTariffTexts} className="card mb-6 space-y-4 p-5">
        <h2 className="font-semibold"><Tr>Textos del tarifario</Tr></h2>
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
          <SubmitButton><Tr>Guardar textos</Tr></SubmitButton>
        </div>
      </Form>

      <h2 className="mb-1 font-semibold"><Tr>Tablas informativas</Tr></h2>
      <p className="mb-4 text-xs text-muted-foreground">
        <Tr>Columnas separadas por</Tr> <code>|</code><Tr>, con ancho opcional en % (</Tr><code><Tr>Concepto:32|Detalle:68</Tr></code><Tr>). Filas: una por línea, celdas separadas por</Tr>{" "}
        <code>|</code><Tr>. Deja la primera celda vacía para continuar un grupo (ej. zonas). Admite</Tr> <code><Tr>**negritas**</Tr></code> <Tr>en la nota.</Tr>
      </p>
      <div className="space-y-4">
        {tables.map((t) => (
          <div key={t.id} className="card p-5">
            <Form action={updateTariffTable.bind(null, t.id)} className="space-y-3">
              <TableFields t={t} sections={sectionNames} />
              <div className="flex justify-end">
                <SubmitButton className="btn-secondary"><Tr>Guardar tabla</Tr></SubmitButton>
              </div>
            </Form>
            <Form action={deleteTariffTable.bind(null, t.id)} className="mt-2 w-fit">
              <ConfirmButton message={tr("¿Eliminar la tabla “{v0}”?", { v0: t.title })} className="btn-danger text-xs">
                <Trash2 className="size-4" /> <Tr>Eliminar</Tr>
              </ConfirmButton>
            </Form>
          </div>
        ))}

        <Form action={createTariffTable} className="card space-y-3 border-dashed p-5">
          <h3 className="font-semibold"><Tr>Nueva tabla</Tr></h3>
          <TableFields sections={sectionNames} />
          <div className="flex justify-end">
            <SubmitButton><Tr>Agregar tabla</Tr></SubmitButton>
          </div>
        </Form>
      </div>
    </div>
  );
}

async function TableFields({ t: table, sections }: { t?: TariffTable; sections: string[] }) {
  const t = await getT();
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_90px]">
        <Field label="Título *">
          <input name="title" required defaultValue={table?.title} className="input font-medium" placeholder={t("Niveles de servicio (SLA)")} />
        </Field>
        <Field label="Va después de la sección">
          <select name="afterSection" defaultValue={table?.afterSection ?? ""} className="input">
            <option value="">{t("Al final del tarifario")}</option>
            {sections.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Orden">
          <input name="sortOrder" type="number" step="1" defaultValue={table?.sortOrder ?? 0} className="input" />
        </Field>
      </div>
      <Field label="Columnas">
        <input name="columns" defaultValue={table?.columns ?? "Concepto:32|Detalle:68"} className="input font-mono text-xs" />
      </Field>
      <Field label="Filas">
        <textarea name="rows" rows={Math.min(14, Math.max(3, (table?.rows.split("\n").length ?? 2) + 1))} defaultValue={table?.rows} className="input font-mono text-xs" />
      </Field>
      <Field label="Nota bajo la tabla (opcional)">
        <textarea name="note" rows={2} defaultValue={table?.note} className="input text-xs" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="inQuotes" defaultChecked={table?.inQuotes} /> <Tr>Imprimir también en las cotizaciones (antes de las condiciones comerciales)</Tr>
      </label>
    </>
  );
}
