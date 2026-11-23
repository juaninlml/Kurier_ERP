"use client";

import { useMemo, useState, useTransition } from "react";
import { Box, CalendarClock, Zap, Calculator, Eraser, Mail, MapPin, PackageCheck, Save, Truck } from "lucide-react";
import { createShipment, quoteShipment, saveShipAddress } from "@/app/actions/shipments";
import { BOROUGH_LIST, boroughOfZip, volumetricKg, zoneOf } from "@/lib/lastmile-zones";
import type { LastMileQuote } from "@/lib/lastmile";
import { Form } from "./Form";
import { SubmitButton } from "./SubmitButton";
import { useT } from "./I18nProvider";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { NumberField } from "./NumberField";
export type SavedAddress = {
  id: number;
  kind: string;
  alias: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  street: string;
  number: string;
  colony: string;
  city: string;
  state: string;
  zip: string;
  reference: string;
  rfc: string;
};
type Addr = Omit<SavedAddress, "id" | "kind" | "alias">;
const EMPTY: Addr = { name: "", company: "", email: "", phone: "", street: "", number: "", colony: "", city: "Ciudad de México", state: "CDMX", zip: "", reference: "", rfc: "" };

/** Formulario de envío de última milla: origen, destino, paquete, cotización por zona y generación de la guía. */
export function ShipmentForm({
  origins,
  destinations,
  clients,
  defaultOrigin,
}: {
  origins: SavedAddress[];
  destinations: SavedAddress[];
  clients: { id: number; name: string }[];
  defaultOrigin: Addr;
}) {
  const t = useT();
  const [origin, setOrigin] = useState<Addr>(defaultOrigin);
  const [dest, setDest] = useState<Addr>(EMPTY);
  const [borough, setBorough] = useState("");
  const [clientId, setClientId] = useState(0);
  const [pkg, setPkg] = useState({ packageType: "CAJA", serviceLevel: "MISMO_DIA", content: "", lengthCm: "", widthCm: "", heightCm: "", weightKg: "", packages: "1", cod: "" });
  const [quote, setQuote] = useState<LastMileQuote | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const autoBorough = boroughOfZip(dest.zip);
  const effBorough = borough || autoBorough;
  const zone = zoneOf(effBorough);
  const vol = volumetricKg(Number(pkg.lengthCm) || 0, Number(pkg.widthCm) || 0, Number(pkg.heightCm) || 0);
  // Una cotización solo vale para el CP / alcaldía / cliente con que se pidió
  const quoteKey = `${dest.zip}|${effBorough}|${clientId}`;
  const [quotedKey, setQuotedKey] = useState("");
  const validQuote = quote?.ok && quotedKey === quoteKey ? quote : null;

  const doQuote = () =>
    start(async () => {
      const q = await quoteShipment({ zip: dest.zip, borough: effBorough, clientId: clientId || null });
      setQuote(q);
      setQuotedKey(quoteKey);
    });

  const save = (kind: "ORIGEN" | "DESTINO", a: Addr) =>
    start(async () => {
      const r = await saveShipAddress(kind, a);
      setSaved((s) => ({ ...s, [kind]: "error" in r ? t(r.error) : t("Dirección guardada en la libreta.") }));
    });

  return (
    <Form action={createShipment} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <AddressPanel
          t={t}
          title={t("Dirección de origen")}
          prefix="origin"
          value={origin}
          onChange={setOrigin}
          saved={origins}
          withRfc
          onSave={() => save("ORIGEN", origin)}
          savedMsg={saved.ORIGEN}
          saveName="saveOrigin"
        />
        <AddressPanel
          t={t}
          title={t("Dirección de destino")}
          prefix="dest"
          value={dest}
          onChange={(a) => {
            setDest(a);
            if (a.zip !== dest.zip) setBorough("");
          }}
          saved={destinations}
          onSave={() => save("DESTINO", dest)}
          savedMsg={saved.DESTINO}
          saveName="saveDest"
          extra={
            <label className="block sm:col-span-2">
              <span className="label">
                {t("Alcaldía")} {zone ? <span className="ml-1 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">{t("ZONA {v0}", { v0: zone })}</span> : null}
              </span>
              <select name="borough" value={effBorough} onChange={(e) => setBorough(e.target.value)} className="input">
                <option value="">{dest.zip.length === 5 ? t("Fuera de la CDMX (sin cobertura)") : t("Se toma del CP")}</option>
                {BOROUGH_LIST.map((b) => (
                  <option key={b} value={b}>
                    {b} · {t("Zona {v0}", { v0: zoneOf(b) })}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted-foreground">{t("Sale del CP; cámbiala si la colonia pertenece a otra alcaldía.")}</span>
            </label>
          }
        />

        <section className="card overflow-hidden">
          <header className="border-b px-5 py-3.5">
            <h2 className="text-[0.95rem] font-semibold">{t("Paquete")}</h2>
          </header>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Tipo de envío")}>
              {(
                [
                  ["SOBRE", t("Sobre"), Mail],
                  ["CAJA", t("Caja"), Box],
                ] as const
              ).map(([v, label, Icon]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={pkg.packageType === v}
                  onClick={() => setPkg({ ...pkg, packageType: v })}
                  className={cn("flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium", pkg.packageType === v ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
              <input type="hidden" name="packageType" value={pkg.packageType} />
            </div>
            <div>
              <span className="label">{t("Servicio")}</span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Servicio")}>
                {(
                  [
                    ["MISMO_DIA", t("Mismo día"), Zap],
                    ["DIA_SIGUIENTE", t("Día siguiente"), CalendarClock],
                  ] as const
                ).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={pkg.serviceLevel === v}
                    onClick={() => setPkg({ ...pkg, serviceLevel: v })}
                    className={cn("flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-medium", pkg.serviceLevel === v ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="serviceLevel" value={pkg.serviceLevel} />
            </div>
            <label className="block">
              <span className="label">{t("Contenido")} *</span>
              <input name="content" required value={pkg.content} onChange={(e) => setPkg({ ...pkg, content: e.target.value })} className="input" placeholder={t("Ej. suplemento alimenticio")} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["lengthCm", t("Largo (cm)")],
                  ["widthCm", t("Ancho (cm)")],
                  ["heightCm", t("Alto (cm)")],
                  ["weightKg", t("Peso (kg)")],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="block">
                  <span className="label">{label}</span>
                  <input name={k} type="number" min="0" step="0.1" inputMode="decimal" value={pkg[k]} onChange={(e) => setPkg({ ...pkg, [k]: e.target.value })} className="input text-right tabular-nums" />
                </label>
              ))}
            </div>
            {vol > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                {t("Peso volumétrico")}: <span className="font-medium text-foreground tabular-nums">{vol} kg</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">{t("Bultos")}</span>
                <input name="packages" type="number" min="1" max="50" step="1" value={pkg.packages} onChange={(e) => setPkg({ ...pkg, packages: e.target.value })} className="input text-right tabular-nums" />
                <span className="mt-1 block text-[11px] text-muted-foreground">{t("Misma parada; una guía por bulto.")}</span>
              </label>
              <label className="block">
                <span className="label">{t("Pago contra entrega")}</span>
                <NumberField name="cod" value={pkg.cod} onValueChange={(_, x) => setPkg({ ...pkg, cod: x })} className="input text-right tabular-nums" placeholder="$0.00" />
              </label>
            </div>
            <label className="block">
              <span className="label">{t("Cliente que paga")}</span>
              <select name="clientId" value={clientId} onChange={(e) => setClientId(Number(e.target.value))} className="input">
                <option value={0}>{t("Sin cliente (venta directa)")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">{t("Notas internas")}</span>
              <input name="notes" className="input" placeholder={t("Opcional")} />
            </label>
          </div>
        </section>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          {!quote ? (
            <p className="text-sm text-muted-foreground">{t("Captura el destino y da clic en Cotizar: el precio sale de la zona de la alcaldía y del tarifario de última milla.")}</p>
          ) : !quote.ok ? (
            <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {t(quote.error)}
            </p>
          ) : (
            <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", !validQuote && "opacity-50")}>
              <div>
                <div className="text-xs text-muted-foreground">
                  {quote.borough} · {t("Zona {v0}", { v0: quote.zone })}
                </div>
                <div className="text-2xl font-semibold text-kurier tabular-nums">
                  {formatMoney(quote.price)} <span className="text-xs font-normal text-muted-foreground">{t("por parada, sin IVA")}</span>
                </div>
              </div>
              <ul className="flex flex-wrap gap-2 text-xs">
                {quote.tiers.map((x) => (
                  <li key={x.label} className={cn("rounded-md px-2 py-1", x.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {t(x.label)} · {formatMoney(x.price)}
                  </li>
                ))}
              </ul>
              {quote.dailyAverage !== null && <span className="text-xs text-muted-foreground">{t("Promedio del cliente: {v0} entregas diarias este mes", { v0: quote.dailyAverage })}</span>}
              {!validQuote && <span className="text-xs font-medium text-amber-700">{t("Cambiaste el destino o el cliente: vuelve a cotizar.")}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={doQuote} disabled={pending || dest.zip.length !== 5} className="btn-secondary">
            <Calculator className="size-4" /> {t("Cotizar")}
          </button>
          <SubmitButton className="btn-kurier" pendingText={t("Generando…")} disabled={!validQuote}>
            <Truck className="size-4" /> {t("Generar guía")}
          </SubmitButton>
        </div>
      </section>
    </Form>
  );
}

function AddressPanel({
  t,
  title,
  prefix,
  value,
  onChange,
  saved: book,
  withRfc,
  onSave,
  savedMsg,
  saveName,
  extra,
}: {
  t: (s: string, v?: Record<string, string | number>) => string;
  title: string;
  prefix: "origin" | "dest";
  value: Addr;
  onChange: (a: Addr) => void;
  saved: SavedAddress[];
  withRfc?: boolean;
  onSave: () => void;
  savedMsg?: string;
  saveName: string;
  extra?: React.ReactNode;
}) {
  const set = (k: keyof Addr, v: string) => onChange({ ...value, [k]: v });
  const f = (k: keyof Addr, label: string, opts: { required?: boolean; type?: string; ph?: string; span?: boolean; name?: string; inputMode?: "numeric" | "tel" | "email" } = {}) => (
    <label className={cn("block", opts.span && "sm:col-span-2")}>
      <span className="label">
        {label}
        {opts.required && " *"}
      </span>
      <input
        name={opts.name ?? `${prefix}${k[0].toUpperCase()}${k.slice(1)}`}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        required={opts.required}
        value={value[k]}
        onChange={(e) => set(k, k === "zip" ? e.target.value.replace(/\D/g, "").slice(0, 5) : e.target.value)}
        placeholder={opts.ph}
        className="input"
      />
    </label>
  );
  const options = useMemo(() => book.map((a) => ({ id: a.id, label: [a.alias, a.name, `${a.street} ${a.number}`.trim(), a.zip].filter(Boolean).join(" · ") })), [book]);
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold">
          <MapPin className="size-4 text-muted-foreground" /> {title}
        </h2>
        <button type="button" onClick={() => onChange({ ...EMPTY })} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Eraser className="size-3.5" /> {t("Limpiar campos")}
        </button>
      </header>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {book.length > 0 && (
          <label className="block sm:col-span-2">
            <span className="label">{t("Direcciones guardadas")}</span>
            <select
              className="input"
              value=""
              onChange={(e) => {
                const a = book.find((x) => x.id === Number(e.target.value));
                if (a) onChange({ name: a.name, company: a.company, email: a.email, phone: a.phone, street: a.street, number: a.number, colony: a.colony, city: a.city, state: a.state, zip: a.zip, reference: a.reference, rfc: a.rfc });
              }}
            >
              <option value="">{t("Busca una dirección guardada…")}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {f("name", t("Nombre completo"), { required: true })}
        {f("company", t("Empresa"))}
        {f("email", t("Email"), { type: "email", inputMode: "email" })}
        {f("phone", t("Teléfono"), { required: prefix === "dest", type: "tel", inputMode: "tel", ph: "55 1234 5678" })}
        {f("street", t("Calle"), { required: true, span: true })}
        {f("number", t("Número"), { ph: t("Ext. e int.") })}
        {f("zip", t("Código postal"), { required: true, inputMode: "numeric", ph: "00000" })}
        {f("colony", t("Colonia"))}
        {f("city", t("Ciudad"))}
        {f("state", t("Estado"))}
        {withRfc ? f("rfc", t("RFC"), { name: "originRfc" }) : null}
        {f("reference", t("Referencia de dirección"), { span: !withRfc, name: `${prefix}Ref`, ph: t("Ej. portón negro, int. 502") })}
        {extra}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={saveName} /> {t("Guardar en la libreta al generar")}
          </label>
          <button type="button" onClick={onSave} className="btn-secondary h-8 text-xs">
            <Save className="size-3.5" /> {t("Guardar")}
          </button>
        </div>
        {savedMsg && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
            <PackageCheck className="size-3.5" /> {savedMsg}
          </p>
        )}
      </div>
    </section>
  );
}
