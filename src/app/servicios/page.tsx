import Link from "next/link";
import { prisma } from "@/lib/db";
import { createService, updateSectionNote } from "@/app/actions/services";
import { PageHeader, Empty } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ServiceFields } from "@/components/ServiceFields";
import { formatMoney } from "@/lib/money";
import { rateLabel } from "@/lib/totals";
import { getSettings } from "@/lib/settings";

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
              <div className="flex items-center justify-between bg-accent px-4 py-2 text-sm font-semibold text-white">
                {sec?.name ?? "Sin sección"}
                <span className="text-xs font-normal opacity-80">{items.length} servicio(s)</span>
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
                          <Link href={`/servicios/${sv.id}`} className="font-medium text-brand hover:underline">
                            {sv.name}
                          </Link>
                          <div className="font-mono text-[10px] text-slate-400">
                            {sv.code}
                            {!sv.active && " · inactivo"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-medium text-accent">
                          {rateLabel(sv, formatMoney)}
                          {sv.priceText && sv.unitPrice > 0 && <div className="text-[10px] font-normal text-slate-400">base {formatMoney(sv.unitPrice)}</div>}
                        </td>
                        <td className="text-xs text-slate-600">{sv.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sec && (
                <form action={updateSectionNote.bind(null, sec.id)} className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
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
                </form>
              )}
            </div>
          ))}
        </div>

        <form action={createService} className="card h-fit space-y-3 p-5 xl:sticky xl:top-6">
          <h2 className="font-semibold">Nuevo servicio</h2>
          <ServiceFields sections={sections.map((x) => x.name)} defaultTaxRate={s.defaultTaxRate} />
          <SubmitButton className="btn-primary w-full">Agregar al tarifario</SubmitButton>
        </form>
      </div>
    </div>
  );
}
