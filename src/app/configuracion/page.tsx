import { getSettings, hasLogo as checkLogo } from "@/lib/settings";
import { saveSettings } from "@/app/actions/settings";
import { PageHeader, Field } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const s = await getSettings();
  const { ok } = await searchParams;
  const hasLogo = await checkLogo();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Configuración" subtitle="Datos de la empresa y marca que aparecen en todos los PDFs" />
      {ok && <div className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Configuración guardada.</div>}

      <form action={saveSettings} className="space-y-6">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Marca</h2>
          <div className="grid gap-5 md:grid-cols-[220px_1fr]">
            <div className="grid h-36 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/logo?v=${s.updatedAt.getTime()}`} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-center text-xs text-slate-500">
                  Sin logo.
                  <br />
                  Sube un PNG o JPG
                  <br />
                  (fondo transparente recomendado)
                </span>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Logo (PNG o JPG, máx. 1 MB)" className="md:col-span-3">
                <input type="file" name="logo" accept="image/png,image/jpeg" className="input" />
              </Field>
              {hasLogo && (
                <label className="flex items-center gap-2 text-sm md:col-span-3">
                  <input type="checkbox" name="removeLogo" /> Quitar logo actual
                </label>
              )}
              <Field label="Color principal">
                <input type="color" name="primaryColor" defaultValue={s.primaryColor} className="input h-10 p-1" />
              </Field>
              <Field label="Color de acento">
                <input type="color" name="accentColor" defaultValue={s.accentColor} className="input h-10 p-1" />
              </Field>
              <Field label="Nombre comercial">
                <input name="tradeName" defaultValue={s.tradeName} className="input" />
              </Field>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Datos fiscales y de contacto</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Razón social" className="md:col-span-2">
              <input name="legalName" defaultValue={s.legalName} className="input" />
            </Field>
            <Field label="RFC">
              <input name="rfc" defaultValue={s.rfc} className="input uppercase" />
            </Field>
            <Field label="Dirección" className="md:col-span-3">
              <input name="address" defaultValue={s.address} className="input" placeholder="Calle, número, colonia" />
            </Field>
            <Field label="Ciudad">
              <input name="city" defaultValue={s.city} className="input" />
            </Field>
            <Field label="Estado">
              <input name="state" defaultValue={s.state} className="input" />
            </Field>
            <Field label="C.P.">
              <input name="zip" defaultValue={s.zip} className="input" />
            </Field>
            <Field label="Teléfono">
              <input name="phone" defaultValue={s.phone} className="input" />
            </Field>
            <Field label="Correo">
              <input name="email" type="email" defaultValue={s.email} className="input" />
            </Field>
            <Field label="Sitio web">
              <input name="website" defaultValue={s.website} className="input" />
            </Field>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Datos bancarios (se muestran en facturas)</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Banco">
              <input name="bankName" defaultValue={s.bankName} className="input" />
            </Field>
            <Field label="Cuenta">
              <input name="bankAccount" defaultValue={s.bankAccount} className="input" />
            </Field>
            <Field label="CLABE">
              <input name="clabe" defaultValue={s.clabe} className="input" />
            </Field>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Folios y valores por defecto</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Prefijo cotización">
              <input name="quotePrefix" defaultValue={s.quotePrefix} className="input" />
            </Field>
            <Field label="Siguiente # cotización">
              <input name="nextQuoteNumber" type="number" min="1" defaultValue={s.nextQuoteNumber} className="input" />
            </Field>
            <Field label="Prefijo factura">
              <input name="invoicePrefix" defaultValue={s.invoicePrefix} className="input" />
            </Field>
            <Field label="Siguiente # factura">
              <input name="nextInvoiceNumber" type="number" min="1" defaultValue={s.nextInvoiceNumber} className="input" />
            </Field>
            <Field label="IVA por defecto %">
              <input name="defaultTaxRate" type="number" step="any" defaultValue={s.defaultTaxRate} className="input" />
            </Field>
            <Field label="Vigencia cotización (días)">
              <input name="quoteValidityDays" type="number" min="0" defaultValue={s.quoteValidityDays} className="input" />
            </Field>
            <Field label="Plazo de pago (días)">
              <input name="paymentTermsDays" type="number" min="0" defaultValue={s.paymentTermsDays} className="input" />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Términos y condiciones por defecto (cotizaciones)">
              <textarea name="quoteTerms" rows={5} defaultValue={s.quoteTerms} className="input" />
            </Field>
            <Field label="Notas por defecto (facturas)">
              <textarea name="invoiceNotes" rows={5} defaultValue={s.invoiceNotes} className="input" />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <SubmitButton>Guardar configuración</SubmitButton>
        </div>
      </form>
    </div>
  );
}
