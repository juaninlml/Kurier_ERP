import Link from "next/link";
import { prisma } from "@/lib/db";
import { createService, updateSectionNote } from "@/app/actions/services";
import { PageHeader, Empty } from "@/components/kit";
import { SubmitButton } from "@/components/SubmitButton";
import { ServiceFields } from "@/components/ServiceFields";
import { formatMoney } from "@/lib/money";
import { rateLabel } from "@/lib/totals";
import { getSettings } from "@/lib/settings";
import { Form } from "@/components/Form";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const [services, sections, s] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.serviceSection.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  const known = new Set(sections.map((x) => x.name));
  const groups = [
    ...sections.map((sec) => ({ sec, items: services.filter((x) => x.section === sec.name) })),
    { sec: null, items: services.filter((x) => !known.has(x.section)) },
  ].filter((g) => g.items.length > 0);

  return (
    <div>
      <PageHeader
        title="Tarifario de servicios"
        subtitle={`${services.filter((x) => x.active).length} servicios activos · Precios sin IVA, MXN. Es la base para armar cotizaciones y facturas.`}
        actions={
          <>
            <a href="/servicios/tablas" className="btn-secondary">
              Textos y tablas del PDF
            </a>
            <a href="/api/pdf/tarifario" target="_blank" className="btn-primary">
              PDF del tarifario
            </a>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {groups.length === 0 && (
            <div className="card">
              <Empty>Aún no hay servicios en el tarifario.</Empty>
            </div>
          )}
          {groups.map(({ sec, items }) => (
            <div key={sec?.id ?? "otros"} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <h2 className="flex items-center gap-2.5 text-[0.95rem] font-semibold">
                  <span className="h-4 w-1 rounded-full bg-kurier" aria-hidden />
                  {sec?.name ?? "Sin sección"}
                </h2>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">{items.length} servicio(s)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th>Tarifa</th>
                      <th>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((sv) => (
                      <tr key={sv.id} className={sv.active ? "" : "opacity-40"}>
                        <td className="min-w-44">
                          <Link href={`/servicios/${sv.id}`} className="font-medium text-primary hover:underline">
                            {sv.name}
                          </Link>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {sv.code}
                            {!sv.active && " · inactivo"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-medium text-kurier">
                          {rateLabel(sv, formatMoney)}
                          {sv.priceText && sv.unitPrice > 0 && <div className="text-[10px] font-normal text-muted-foreground">base {formatMoney(sv.unitPrice)}</div>}
                        </td>
                        <td className="text-xs text-muted-foreground">{sv.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sec && (
                <Form action={updateSectionNote.bind(null, sec.id)} className="flex items-start gap-2 border-t border-border bg-muted px-4 py-3">
                  <textarea
                    name="note"
                    rows={sec.note ? 2 : 1}
                    defaultValue={sec.note}
                    placeholder="Nota de la sección (se imprime debajo de la tabla en la cotización)"
                    className="input text-xs italic"
                  />
                  <SubmitButton className="btn-secondary whitespace-nowrap text-xs" pendingText="…">
                    Guardar nota
                  </SubmitButton>
                </Form>
              )}
            </div>
          ))}
        </div>

        <Form action={createService} className="card h-fit space-y-3 p-5 xl:sticky xl:top-6">
          <h2 className="font-semibold">Nuevo servicio</h2>
          <ServiceFields sections={sections.map((x) => x.name)} defaultTaxRate={s.defaultTaxRate} />
          <SubmitButton className="btn-primary w-full">Agregar al tarifario</SubmitButton>
        </Form>
      </div>
    </div>
  );
}
