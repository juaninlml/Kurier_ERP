import type { Brand } from "@prisma/client";
import { ChevronDown, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { createBrand, updateBrand } from "@/app/actions/brands";
import { Field } from "./kit";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { Badge } from "@/components/ui/badge";

/**
 * Configuración → Marcas comerciales. La principal son los datos de arriba; cada marca
 * adicional cambia nombre, contacto, logo y colores de las cotizaciones, facturas y PDFs
 * de los clientes asignados a ella.
 */
export async function BrandsPanel({ mainName }: { mainName: string }) {
  const brands = await prisma.brand.findMany({
    orderBy: { tradeName: "asc" },
    omit: { logoData: true },
    include: { _count: { select: { clients: true, invoices: true } } },
  });
  return (
    <section className="card mt-6 overflow-hidden">
      <header className="border-b px-5 py-4">
        <h2 className="font-semibold">Marcas comerciales</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Si facturas con más de una marca, da de alta aquí las adicionales y asigna cada cliente a su marca (en la ficha del cliente). Sus documentos salen con el nombre, correo, teléfono, logo y
          colores de esa marca. La principal es <strong className="font-medium text-foreground">{mainName}</strong>, con los datos de arriba.
        </p>
      </header>
      <ul className="divide-y">
        {brands.map((b) => (
          <li key={b.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: b.primaryColor }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{b.tradeName}</span>
                    {!b.active && <Badge variant="secondary">Inactiva</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{[b.legalName, b.email, b.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</div>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {b._count.clients} cliente(s) · {b._count.invoices} factura(s)
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t bg-muted/30 px-5 py-4">
                <Form action={updateBrand.bind(null, b.id)} successMessage="Marca guardada." className="space-y-4">
                  <BrandFields brand={b} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="active" value="on" defaultChecked={b.active} /> Activa (aparece al facturar)
                      <input type="hidden" name="active" value="off" />
                    </label>
                    <SubmitButton>Guardar marca</SubmitButton>
                  </div>
                </Form>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <details className="group border-t" open={brands.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-primary hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
          <Plus className="size-4" /> Agregar marca
        </summary>
        <div className="border-t bg-muted/30 px-5 py-4">
          <Form action={createBrand} resetOnSuccess className="space-y-4">
            <BrandFields />
            <div className="flex justify-end">
              <SubmitButton>Agregar marca</SubmitButton>
            </div>
          </Form>
        </div>
      </details>
    </section>
  );
}

function BrandFields({ brand }: { brand?: Omit<Brand, "logoData"> }) {
  return (
    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
      <div className="space-y-2">
        <div className="grid h-28 place-items-center rounded-lg border border-dashed bg-background p-2">
          {brand?.logoMime ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/logo/${brand.id}?v=${brand.updatedAt.getTime()}`} alt={`Logo de ${brand.tradeName}`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-center text-xs text-muted-foreground">Sin logo</span>
          )}
        </div>
        <input type="file" name="logo" accept="image/png,image/jpeg" aria-label="Logo (PNG o JPG, máx. 1 MB)" className="input text-xs" />
        {brand?.logoMime && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="removeLogo" /> Quitar logo
          </label>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nombre comercial *">
          <input name="tradeName" required defaultValue={brand?.tradeName} className="input" placeholder="LOE Fulfillment" />
        </Field>
        <Field label="Leyenda bajo el nombre" className="md:col-span-2">
          <input name="tagline" defaultValue={brand?.tagline} className="input" placeholder="Fulfillment para dropshipping internacional" />
        </Field>
        <Field label="Razón social" hint="Vacío = la de la marca principal">
          <input name="legalName" defaultValue={brand?.legalName} className="input" placeholder="Logística Oriente Express S.A. de C.V." />
        </Field>
        <Field label="RFC" hint="Vacío = el de la principal">
          <input name="rfc" defaultValue={brand?.rfc} className="input uppercase" />
        </Field>
        <Field label="Sitio web">
          <input name="website" defaultValue={brand?.website} className="input" />
        </Field>
        <Field label="Correo">
          <input name="email" type="email" defaultValue={brand?.email} className="input" />
        </Field>
        <Field label="Teléfono">
          <input name="phone" defaultValue={brand?.phone} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Color principal">
            <input type="color" name="primaryColor" defaultValue={brand?.primaryColor ?? "#1F4E79"} className="input" />
          </Field>
          <Field label="Acento">
            <input type="color" name="accentColor" defaultValue={brand?.accentColor ?? "#ED7D31"} className="input" />
          </Field>
        </div>
        <Field label="Dirección" className="md:col-span-3" hint="Vacía = la de la principal">
          <input name="address" defaultValue={brand?.address} className="input" />
        </Field>
        <Field label="Ciudad">
          <input name="city" defaultValue={brand?.city} className="input" />
        </Field>
        <Field label="Estado">
          <input name="state" defaultValue={brand?.state} className="input" />
        </Field>
        <Field label="C.P.">
          <input name="zip" defaultValue={brand?.zip} className="input" />
        </Field>
        <Field label="Banco" hint="Vacío = los datos bancarios de la principal">
          <input name="bankName" defaultValue={brand?.bankName} className="input" />
        </Field>
        <Field label="Cuenta">
          <input name="bankAccount" defaultValue={brand?.bankAccount} className="input" />
        </Field>
        <Field label="CLABE">
          <input name="clabe" defaultValue={brand?.clabe} className="input" />
        </Field>
        <Field label="Prefijo de cotizaciones" hint="Vacío = el de la principal">
          <input name="quotePrefix" defaultValue={brand?.quotePrefix} className="input uppercase" placeholder="LOE-COT" />
        </Field>
        <Field label="Prefijo de facturas" hint="El consecutivo es uno solo para todas las marcas">
          <input name="invoicePrefix" defaultValue={brand?.invoicePrefix} className="input uppercase" placeholder="LOE" />
        </Field>
      </div>
    </div>
  );
}
