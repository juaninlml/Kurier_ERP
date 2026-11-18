import Link from "next/link";
import { prisma } from "@/lib/db";
import { createService } from "@/app/actions/services";
import { PageHeader, Empty, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatMoney } from "@/lib/money";
import { UNITS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const [services, s] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ active: "desc" }, { code: "asc" }] }),
    getSettings(),
  ]);

  return (
    <div>
      <PageHeader title="Catálogo de servicios" subtitle="Precios base para armar cotizaciones y facturas rápidamente" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card overflow-x-auto">
          {services.length === 0 ? (
            <Empty>Aún no hay servicios en el catálogo.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Servicio</th>
                  <th>Unidad</th>
                  <th className="text-right">Precio</th>
                  <th className="text-right">IVA</th>
                </tr>
              </thead>
              <tbody>
                {services.map((sv) => (
                  <tr key={sv.id} className={sv.active ? "" : "opacity-50"}>
                    <td className="font-mono text-xs">{sv.code}</td>
                    <td>
                      <Link href={`/servicios/${sv.id}`} className="font-medium text-brand hover:underline">
                        {sv.name}
                      </Link>
                      {sv.description && <div className="text-xs text-slate-500">{sv.description}</div>}
                    </td>
                    <td>{sv.unit}</td>
                    <td className="text-right tabular-nums">{formatMoney(sv.unitPrice)}</td>
                    <td className="text-right tabular-nums">{sv.taxRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form action={createService} className="card h-fit space-y-3 p-5">
          <h2 className="font-semibold">Nuevo servicio</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Clave *">
              <input name="code" required className="input uppercase" placeholder="PP-01" />
            </Field>
            <Field label="Unidad">
              <input name="unit" list="units-list" defaultValue="Pedido" className="input" />
            </Field>
          </div>
          <Field label="Nombre *">
            <input name="name" required className="input" placeholder="Pick & Pack" />
          </Field>
          <Field label="Descripción">
            <textarea name="description" rows={2} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio unitario">
              <input name="unitPrice" type="number" step="0.01" min="0" defaultValue="0" className="input" />
            </Field>
            <Field label="IVA %">
              <input name="taxRate" type="number" step="any" min="0" defaultValue={s.defaultTaxRate} className="input" />
            </Field>
          </div>
          <datalist id="units-list">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <SubmitButton className="btn-primary w-full">Agregar al catálogo</SubmitButton>
        </form>
      </div>
    </div>
  );
}
