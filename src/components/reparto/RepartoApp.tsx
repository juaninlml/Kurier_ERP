"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Boxes, Camera, CheckCircle2, Loader2, Lock, Map as MapIcon, MapPin, Navigation, PackageCheck, Phone, ScanLine, Truck, Undo2, X } from "lucide-react";
import {
  cancelEmptyLoad,
  closeLoad,
  confirmDelivery,
  failedAttempt,
  finishMyLoad,
  lookupDelivery,
  removeFromLoad,
  scanLoad,
  startLoad,
  type DeliveryInfo,
  type LoadState,
} from "@/app/actions/reparto";
import { FAIL_REASONS } from "@/lib/lastmile-zones";
import { DEPOT } from "@/lib/route-order";
import { Scanner } from "./Scanner";
import { ScanFlash, type Flash } from "./ScanFlash";
import { playSound, unlockAudio, type Feedback } from "./feedback";
import { SignaturePad, type SignatureHandle } from "./SignaturePad";
import { cn } from "@/lib/utils";
import { useT } from "../I18nProvider";

/**
 * Google Maps con la ruta en coche hasta la dirección (en Android abre la app de Maps directo).
 * Las guías aún no tienen coordenadas: se manda la dirección completa con la ciudad para que Maps la ubique.
 */
const place = (address: string) => `${address}, Ciudad de México, México`;
/** Destino para Maps: las coordenadas que dio el cliente (exactas) o, si no hay, la dirección escrita. */
type Where = { address: string; lat?: number | null; lng?: number | null };
const target = (w: Where) => (w.lat != null && w.lng != null ? `${w.lat},${w.lng}` : place(w.address));
const mapsUrl = (w: Where) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target(w))}&travelmode=driving`;
/** Toda la ruta pendiente en orden, saliendo de la base (Maps acepta hasta 9 paradas intermedias). */
const routeUrl = (stops: DeliveryInfo[]) => {
  const list = stops.slice(0, 10);
  const last = list[list.length - 1];
  const via = list.slice(0, -1).map(target).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(place(DEPOT.address))}&destination=${encodeURIComponent(target(last))}${via ? `&waypoints=${encodeURIComponent(via)}` : ""}&travelmode=driving`;
};

function MapsButton({ to, className, label }: { to: Where; className?: string; label?: string }) {
  const t = useT();
  return (
    <a href={mapsUrl(to)} target="_blank" rel="noreferrer" className={cn("btn-primary", className)}>
      <Navigation className="size-4" /> {label ?? t("Cómo llegar")}
    </a>
  );
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

/** Reduce la foto (máx. 1600 px, JPEG) antes de subirla: las fotos del celular pesan varios MB. */
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar la foto."))), "image/jpeg", 0.8));
}

/** Pasos del flujo: 1 almacenamiento · 2 paquetes · 3 entregar. */
function Steps({ step }: { step: 1 | 2 | 3 }) {
  const t = useT();
  const steps = [t("Almacenamiento"), t("Paquetes"), t("Entregar")];
  return (
    <ol className="grid grid-cols-[1.35fr_1fr_1fr] gap-1" aria-label={t("Pasos")}>
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const state = n < step ? "done" : n === step ? "now" : "next";
        return (
          <li
            key={label}
            aria-current={state === "now" ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-2 text-xs font-semibold",
              state === "now" && "bg-primary text-primary-foreground",
              state === "done" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
              state === "next" && "bg-muted text-muted-foreground",
            )}
          >
            <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px]", state === "now" ? "bg-primary-foreground/20" : "bg-background/70")}>
              {state === "done" ? <CheckCircle2 className="size-3.5" /> : n}
            </span>
            <span className="truncate">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * App de reparto, un solo flujo guiado:
 *   1. Escanear la etiqueta del almacenamiento del transporte.
 *   2. Escanear los paquetes que van dentro y cerrar la carga.
 *   3. Entregar (bloqueado aquí hasta terminar la ruta): escanear la guía → firma → foto → confirmar.
 * El estado vive en el servidor: recargar o cambiar de teléfono no lo pierde.
 */
export function RepartoApp({ driver, initialLoad }: { driver: string; initialLoad: LoadState | null }) {
  const t = useT();
  const [load, setLoad] = useState<LoadState | null>(initialLoad);
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState<DeliveryInfo | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [flash, setFlash] = useState<Flash | null>(null);
  const notify = (kind: Feedback, title: string, sub?: string) => {
    playSound(kind);
    setFlash({ kind, title, sub, seq: Date.now() });
  };
  // El navegador solo deja sonar después del primer toque o tecla
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const clear = () => {
    setError("");
    setDone("");
  };

  // ── Paso 1: almacenamiento ──
  const onStorage = (code: string) =>
    start(async () => {
      clear();
      const r = await startLoad(code);
      if (r.ok) {
        setLoad(r.load);
        notify("ok", t("Almacenamiento listo"), t("{v0} · ahora escanea los paquetes", { v0: r.load.storageName }));
      } else {
        setError(r.error);
        notify("error", t("No se abrió la carga"), r.error);
      }
    });

  // ── Paso 2: paquetes ──
  const onPackage = (code: string) =>
    start(async () => {
      clear();
      const r = await scanLoad(code);
      if (!r.ok) {
        setError(r.error);
        return notify("error", t("No se cargó"), r.error);
      }
      setLoad((l) => (l && !l.items.some((i) => i.id === r.info.id) ? { ...l, items: [r.info, ...l.items] } : l));
      if (r.again) notify("repeat", t("Ya estaba en esta carga"), `${r.info.tracking} · ${r.info.destName}`);
      else notify("ok", t("Cargado"), t("{v0} · {v1} · Zona {v2}", { v0: r.info.tracking, v1: r.info.borough, v2: r.info.zone }));
    });

  const onRemove = (item: DeliveryInfo) =>
    start(async () => {
      clear();
      const r = await removeFromLoad(item.id);
      if (r.ok) setLoad((l) => (l ? { ...l, items: l.items.filter((i) => i.id !== item.id) } : l));
      else setError(r.error);
    });

  const onClose = () => {
    if (!load) return;
    if (!window.confirm(t("¿Cerrar la carga con {n} paquete(s)?\n\nDespués ya no podrás cargar más: la app quedará solo en Entrega hasta que termines la ruta.", { n: load.items.length }))) return;
    start(async () => {
      clear();
      const r = await closeLoad();
      if (r.ok) {
        setLoad(r.load);
        notify("ok", t("Carga cerrada"), t("Ahora escanea la guía de cada paquete al entregarlo"));
      } else {
        setError(r.error);
        notify("error", t("No se cerró"), r.error);
      }
    });
  };

  const onCancelEmpty = () =>
    start(async () => {
      clear();
      const r = await cancelEmptyLoad();
      if (r.ok) setLoad(null);
      else setError(r.error);
    });

  // ── Paso 3: entregar ──
  const onDeliverScan = (code: string) =>
    start(async () => {
      clear();
      const r = await lookupDelivery(code);
      if (r.ok) {
        setCurrent(r.info);
        notify("ok", t("Guía encontrada"), `${r.info.destName} · ${r.info.borough}`);
      } else {
        setError(r.error);
        const repeat = /ya fue entregada|already delivered/.test(r.error);
        notify(repeat ? "repeat" : "error", repeat ? t("Ya estaba entregada") : t("No se puede entregar"), r.error);
      }
    });

  const onFinish = () => {
    if (!load) return;
    const left = load.items.filter((i) => i.status === "EN_RUTA").length;
    const msg = left
      ? t("Quedan {n} paquete(s) sin entregar.\n\nAl terminar regresan al almacén: entrégalos ahí. ¿Terminar la ruta?", { n: left })
      : t("¿Terminar la ruta? Todos los paquetes quedaron entregados.");
    if (!window.confirm(msg)) return;
    start(async () => {
      clear();
      const r = await finishMyLoad();
      if (r.ok) {
        setLoad(null);
        setCurrent(null);
        setDone(r.returned ? t("Ruta terminada. {n} paquete(s) regresan al almacén.", { n: r.returned }) : t("Ruta terminada. ¡Todo entregado!"));
        notify("delivered", t("Ruta terminada"), r.returned ? t("{n} paquete(s) regresan al almacén", { n: r.returned }) : t("Todo entregado"));
      } else {
        setError(r.error);
        notify("error", t("No se terminó"), r.error);
      }
    });
  };

  const step: 1 | 2 | 3 = !load ? 1 : load.status === "CARGANDO" ? 2 : 3;
  const route = load ? routeOrder(load.items) : [];
  const nextStop = route.find((i) => i.status === "EN_RUTA" && !i.attempts) ?? route.find((i) => i.status === "EN_RUTA") ?? null;
  const delivered = load ? load.items.filter((i) => i.status === "ENTREGADA").length : 0;
  const total = load?.items.length ?? 0;

  return (
    <div className="mx-auto max-w-md space-y-4 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("Reparto")}</h1>
          <p className="text-sm text-muted-foreground">{driver}</p>
        </div>
        {load && (
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-sm font-semibold">
              {step === 3 && <Lock className="size-3.5 text-muted-foreground" aria-label={t("Bloqueado en entrega")} />}
              {load.storageName}
            </p>
            <p className="font-mono text-xs text-muted-foreground">{load.storageCode}</p>
          </div>
        )}
      </div>

      <Steps step={step} />

      {done && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="size-5 shrink-0" /> {done}
        </p>
      )}

      {step === 1 && (
        <>
          <Instruction icon={Boxes} title={t("Escanea el almacenamiento")} text={t("Escanea la etiqueta AL-… de la jaula o caja del transporte donde vas a cargar.")} />
          <Scanner onCode={onStorage} paused={pending} hint={t("Etiqueta del almacenamiento")} />
        </>
      )}

      {step === 2 && load && (
        <>
          <Instruction icon={ScanLine} title={t("Escanea los paquetes de {v0}", { v0: load.storageName })} text={t("Escanea cada paquete al meterlo. Cuando termines, cierra la carga.")} />
          <Scanner onCode={onPackage} paused={pending} hint={t("Guía de cada paquete")} />
          <section aria-live="polite" className="card overflow-hidden">
            <header className="flex items-center justify-between border-b px-4 py-2.5 text-sm">
              <span className="font-semibold">{t("En esta carga")}</span>
              <span key={total} className="rp-bump text-lg font-bold tabular-nums">{total}</span>
            </header>
            {total === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("Aún no hay paquetes. Escanea la guía de cada uno.")}</p>
            ) : (
              <ul className="max-h-80 divide-y overflow-y-auto">
                {load.items.map((it, i) => (
                  <li key={it.id} className={cn("flex items-center gap-2.5 px-4 py-2.5 text-sm", i === 0 && "rp-slide")}>
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-medium">{it.tracking}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {it.destName} · {it.borough} · Z{it.zone}
                      </div>
                    </div>
                    <button type="button" onClick={() => onRemove(it)} disabled={pending} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={t("Bajar {v0} de la carga", { v0: it.tracking })}>
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {step === 3 && load && (
        current ? (
          <Delivery
            info={current}
            expected={nextStop && nextStop.id !== current.id ? nextStop : null}
            onCancel={() => setCurrent(null)}
            onDone={(msg, kind, title, patch) => {
              setLoad((l) => (l ? { ...l, items: l.items.map((i) => (i.id === current.id ? { ...i, ...patch } : i)) } : l));
              setCurrent(null);
              setDone(msg);
              notify(kind, title, msg);
            }}
            onError={(msg) => notify("error", t("Falta algo"), msg)}
          />
        ) : (
          <>
            <section className="card p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{t("Entregados")}</span>
                <span className="text-lg font-bold tabular-nums">
                  {delivered} <span className="text-sm font-medium text-muted-foreground">{t("de {n}", { n: total })}</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={delivered}>
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${total ? (delivered / total) * 100 : 0}%` }} />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" /> {t("Ruta calculada saliendo de {v0}", { v0: DEPOT.short })}
              </p>
              <ol className="mt-3 grid grid-cols-4 gap-1 text-center text-[11px] leading-tight text-muted-foreground">
                {[t("Escanea la guía"), t("Pide la firma"), t("Toma la foto"), t("Confirma")].map((s, i) => (
                  <li key={s} className="rounded-md bg-muted px-1 py-1.5">
                    <span className="block font-bold text-foreground">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </section>
            <NextStop stop={nextStop} total={total} />
            <Scanner onCode={onDeliverScan} paused={pending} hint={nextStop ? t("Escanea la guía de la parada {v0}", { v0: nextStop.seq ?? "" }).trim() : t("Escanea la guía del paquete que vas a entregar")} />
            <Manifest items={route} nextId={nextStop?.id ?? null} />
          </>
        )
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {/* Acción principal de cada paso, siempre a la mano */}
      {step === 2 && load && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-md">
            {total > 0 ? (
              <button type="button" onClick={onClose} disabled={pending} className="btn-kurier h-12 w-full text-base">
                {pending ? <Loader2 className="size-5 animate-spin" /> : <Truck className="size-5" />} {t("Cerrar carga ({n})", { n: total })}
              </button>
            ) : (
              <button type="button" onClick={onCancelEmpty} disabled={pending} className="btn-secondary h-12 w-full">
                <Undo2 className="size-4" /> {t("Cambiar de almacenamiento")}
              </button>
            )}
          </div>
        </div>
      )}
      {step === 3 && load && !current && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-md">
            <button type="button" onClick={onFinish} disabled={pending} className={cn("h-12 w-full text-base", delivered === total ? "btn-kurier" : "btn-secondary")}>
              {pending ? <Loader2 className="size-5 animate-spin" /> : <PackageCheck className="size-5" />} {t("Terminar ruta")}
            </button>
          </div>
        </div>
      )}
      <ScanFlash flash={flash} />
    </div>
  );
}

function Instruction({ icon: Icon, title, text }: { icon: typeof Boxes; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/** Paradas en orden de entrega (número de parada; las que aún no lo tienen, al final). */
function routeOrder(items: DeliveryInfo[]) {
  return [...items].sort((a, b) => (a.seq ?? 1e9) - (b.seq ?? 1e9) || a.id - b.id);
}

/** Número de parada en un círculo; palomita si ya se entregó. */
function StopBadge({ it, next }: { it: DeliveryInfo; next?: boolean }) {
  const t = useT();
  if (it.status === "ENTREGADA")
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" aria-label={t("Parada {v0} entregada", { v0: it.seq ?? "" })}>
        <CheckCircle2 className="size-5" />
      </span>
    );
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
        next ? "bg-primary text-primary-foreground" : it.attempts ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" : "bg-muted text-foreground",
      )}
      aria-label={t("Parada {v0}", { v0: it.seq ?? "" })}
    >
      {it.seq ?? "·"}
    </span>
  );
}

/** "Siguiente entrega": a dónde ir ahora. Cambia sola al entregar o registrar un intento. */
function NextStop({ stop, total }: { stop: DeliveryInfo | null; total: number }) {
  const t = useT();
  if (!stop)
    return (
      <section className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <CheckCircle2 className="size-6 shrink-0" />
        <div>
          <h2 className="font-semibold">{t("¡Terminaste las entregas!")}</h2>
          <p className="text-sm opacity-80">{t("Regresa al almacén y toca “Terminar ruta”.")}</p>
        </div>
      </section>
    );
  return (
    <section className="rp-slide overflow-hidden rounded-xl border-2 border-primary bg-card" key={stop.id} aria-live="polite">
      <header className="flex items-center justify-between bg-primary px-4 py-2 text-primary-foreground">
        <span className="text-sm font-semibold">{stop.attempts ? t("Reintentar entrega") : t("Siguiente entrega")}</span>
        <span className="text-sm font-bold tabular-nums">
          {t("Parada {v0}", { v0: stop.seq ?? "—" })} <span className="font-medium opacity-80">{t("de {n}", { n: total })}</span>
        </span>
      </header>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg leading-tight font-semibold">{stop.destName}</h2>
          {stop.cod > 0 && <span className="shrink-0 rounded-md bg-foreground px-2 py-1 text-xs font-bold text-background">{t("COBRAR")} {money(stop.cod)}</span>}
        </div>
        <a href={mapsUrl(stop)} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 text-sm underline-offset-2 hover:underline">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> {stop.address}
        </a>
        {stop.destRef && <p className="pl-5.5 text-sm text-muted-foreground">{t("Ref:")} {stop.destRef}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <MapsButton to={stop} className="h-10 text-sm" label={stop.lat != null ? t("Cómo llegar (ubicación exacta)") : undefined} />
          <a href={`tel:${stop.destPhone}`} className="btn-secondary h-10 text-sm">
            <Phone className="size-4" /> {t("Llamar")}
          </a>
          <span className="rounded-md bg-muted px-2 py-1.5 text-xs">
            {stop.borough} · Z{stop.zone}
          </span>
          {stop.attempts > 0 && <span className="rounded-md bg-amber-100 px-2 py-1.5 text-xs text-amber-900">{t("{n} intento(s)", { n: stop.attempts })}</span>}
        </div>
        <p className="text-xs text-muted-foreground">{t("Al llegar, escanea la guía de este paquete.")}</p>
      </div>
    </section>
  );
}

/** La ruta completa en orden de entrega. Tocar una parada muestra su dirección. */
function Manifest({ items, nextId }: { items: DeliveryInfo[]; nextId: number | null }) {
  const t = useT();
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2 text-sm font-semibold">
        {t("Tu ruta en orden")}
        {items.some((x) => x.status !== "ENTREGADA") && (
          <a href={routeUrl(items.filter((x) => x.status !== "ENTREGADA"))} target="_blank" rel="noreferrer" className="btn-secondary h-8 text-xs">
            <MapIcon className="size-3.5" /> {t("Ver ruta en Maps")}
          </a>
        )}
      </header>
      <ol className="divide-y">
        {items.map((it) => {
          const delivered = it.status === "ENTREGADA";
          const next = it.id === nextId;
          return (
            <li key={it.id} className={cn(next && "bg-primary/5")}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
                  <StopBadge it={it} next={next} />
                  <div className={cn("min-w-0 flex-1", delivered && "opacity-60")}>
                    <div className={cn("truncate font-medium", delivered && "line-through decoration-1")}>{it.destName}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {it.borough} · CP {it.address.match(/CP (\d{5})/)?.[1] ?? ""} · <span className="font-mono">{it.tracking}</span>
                      {it.attempts > 0 && !delivered ? ` · ${t("{n} intento(s)", { n: it.attempts })}` : ""}
                    </div>
                  </div>
                  {next && <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">{t("AHORA")}</span>}
                  {!next && it.cod > 0 && !delivered && <span className="shrink-0 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-bold text-background">{t("COBRAR")}</span>}
                </summary>
                <div className="space-y-2 px-4 pb-3 pl-15 text-sm">
                  <p className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {it.address}
                  </p>
                  {it.destRef && <p className="text-muted-foreground">{t("Ref:")} {it.destRef}</p>}
                  {!delivered && (
                    <div className="flex flex-wrap items-center gap-2">
                      <MapsButton to={it} className="h-9 text-xs" />
                      <a href={`tel:${it.destPhone}`} className="btn-secondary h-9 text-xs">
                        <Phone className="size-3.5" /> {t("Llamar")}
                      </a>
                      <span className="text-xs text-muted-foreground">{t("Para entregar, escanea su guía.")}</span>
                    </div>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Delivery({
  info,
  expected,
  onCancel,
  onDone,
  onError,
}: {
  info: DeliveryInfo;
  /** La parada que tocaba según la ruta, si se escaneó otra. */
  expected: DeliveryInfo | null;
  onCancel: () => void;
  onDone: (msg: string, kind: Feedback, title: string, patch: Partial<DeliveryInfo>) => void;
  onError: (msg: string) => void;
}) {
  const t = useT();
  const sig = useRef<SignatureHandle>(null);
  const [signed, setSigned] = useState(false);
  const [receiver, setReceiver] = useState(info.destName);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [view, setView] = useState<"entregar" | "fallo">("entregar");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError("");
      const signature = await sig.current?.toBlob();
      if (!signed || !signature) {
        setError(t("Pide la firma de quien recibe."));
        return onError(t("Pide la firma de quien recibe."));
      }
      if (!photo) {
        setError(t("Toma la foto de la entrega."));
        return onError(t("Toma la foto de la entrega."));
      }
      const fd = new FormData();
      fd.set("tracking", info.tracking);
      fd.set("receiverName", receiver);
      fd.set("signature", new File([signature], "firma.png", { type: "image/png" }));
      fd.set("photo", new File([photo.blob], "entrega.jpg", { type: "image/jpeg" }));
      const r = await confirmDelivery(fd);
      if (r.ok) onDone(t("Guía {v0} entregada a {v1}.", { v0: r.tracking, v1: receiver }), "delivered", t("¡Entregado!"), { status: "ENTREGADA" });
      else {
        setError(r.error);
        onError(r.error);
      }
    });

  const sendFail = () =>
    start(async () => {
      setError("");
      const r = await failedAttempt(info.tracking, reason, note);
      if (r.ok) onDone(t("Intento {n} registrado para {v0}. El paquete sigue en tu carga.", { n: r.attempts, v0: info.tracking }), "attempt", t("Intento {n} registrado", { n: r.attempts }), { attempts: r.attempts });
      else {
        setError(r.error);
        onError(r.error);
      }
    });

  return (
    <div className="space-y-4">
      {expected && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {t("Esta es la parada {v0}. Según tu ruta tocaba la {v1} ({v2}). Puedes entregarla de todos modos.", { v0: info.seq ?? "—", v1: expected.seq ?? "—", v2: expected.destName })}
          </span>
        </p>
      )}
      <section className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {info.seq ? `${t("Parada {v0}", { v0: info.seq })} · ` : ""}
              {info.tracking}
            </p>
            <h2 className="text-lg font-semibold">{info.destName}</h2>
          </div>
          <span className="rounded-md bg-foreground px-2 py-1 text-xs font-bold text-background">Z{info.zone}</span>
        </div>
        <a href={mapsUrl(info)} target="_blank" rel="noreferrer" className="mt-2 flex items-start gap-1.5 text-sm underline-offset-2 hover:underline">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> {info.address}
        </a>
        {info.destRef && <p className="mt-1 pl-5.5 text-sm text-muted-foreground">{t("Ref:")} {info.destRef}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <MapsButton to={info} className="h-9 text-xs" />
          <a href={`tel:${info.destPhone}`} className="btn-secondary h-9 text-xs">
            <Phone className="size-3.5" /> {t("Llamar")}
          </a>
          <span className="rounded-md bg-muted px-2 py-2">{t("{n} bulto(s)", { n: info.packages })}</span>
          <span className="rounded-md bg-muted px-2 py-2">{t(info.service)}</span>
          {info.attempts > 0 && <span className="rounded-md bg-amber-100 px-2 py-2 text-amber-900">{t("Intentos previos: {n}", { n: info.attempts })}</span>}
        </div>
        {info.cod > 0 && <p className="mt-3 rounded-lg bg-foreground px-3 py-2 text-center text-sm font-bold text-background">{t("COBRAR AL ENTREGAR")} {money(info.cod)}</p>}
      </section>

      {view === "entregar" ? (
        <section className="card space-y-4 p-4">
          <label className="block">
            <span className="label">{t("¿Quién recibe?")}</span>
            <input value={receiver} onChange={(e) => setReceiver(e.target.value)} autoComplete="off" className="input h-11" />
          </label>
          <div>
            <span className="label">{t("Firma de quien recibe")}</span>
            <SignaturePad ref={sig} onChange={(empty) => setSigned(!empty)} />
          </div>
          <div>
            <span className="label">{t("Foto de la entrega")}</span>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt={t("Foto de la entrega")} className="mb-2 max-h-60 w-full rounded-xl object-cover" />
            )}
            <label className="btn-secondary h-11 w-full cursor-pointer">
              <Camera className="size-4" /> {photo ? t("Tomar otra foto") : t("Tomar foto")}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const blob = await compress(f);
                    setPhoto((p) => {
                      if (p) URL.revokeObjectURL(p.url);
                      return { blob, url: URL.createObjectURL(blob) };
                    });
                  } catch {
                    setError(t("No se pudo leer la foto. Intenta de nuevo."));
                  }
                }}
              />
            </label>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
          <button type="button" onClick={submit} disabled={pending} className="btn-kurier h-12 w-full text-base">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />} {t("Confirmar entrega")}
          </button>
          <div className="flex justify-between">
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Undo2 className="size-4" /> {t("Regresar a la lista")}
            </button>
            <button type="button" onClick={() => setView("fallo")} className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {t("No se pudo entregar")}
            </button>
          </div>
        </section>
      ) : (
        <section className="card space-y-3 p-4">
          <h3 className="font-semibold">{t("Intento sin entregar")}</h3>
          <fieldset className="space-y-1.5">
            <legend className="sr-only">{t("Motivo")}</legend>
            {FAIL_REASONS.map((r) => (
              <label key={r} className={cn("flex h-11 items-center gap-2 rounded-lg border px-3 text-sm", reason === r && "border-primary bg-primary/5")}>
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} /> {t(r)}
              </label>
            ))}
          </fieldset>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={reason === "Otro" ? t("¿Qué pasó? (obligatorio)") : t("Comentario (opcional)")} className="input h-11" />
          {error && <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
          <button type="button" onClick={sendFail} disabled={pending || !reason} className="btn-danger h-12 w-full">
            {pending && <Loader2 className="size-4 animate-spin" />} {t("Registrar intento {n}", { n: info.attempts + 1 })}
          </button>
          <button type="button" onClick={() => setView("entregar")} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Undo2 className="size-4" /> {t("Regresar a entregar")}
          </button>
        </section>
      )}
    </div>
  );
}
