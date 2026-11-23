"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, CheckCircle2, CircleX, Loader2, MapPin, PackageCheck, Phone, Truck, Undo2 } from "lucide-react";
import { confirmDelivery, failedAttempt, lookupDelivery, scanLoad, type DeliveryInfo } from "@/app/actions/reparto";
import { FAIL_REASONS } from "@/lib/lastmile-zones";
import { Scanner } from "./Scanner";
import { ScanFlash, type Flash } from "./ScanFlash";
import { playSound, unlockAudio, type Feedback } from "./feedback";
import { SignaturePad, type SignatureHandle } from "./SignaturePad";
import { cn } from "@/lib/utils";

type Mode = "cargar" | "entregar";
type LoadItem = { key: number; ok: boolean; text: string; sub?: string };
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

/** App de reparto: escanear al cargar el vehículo y al entregar (firma + foto) o registrar un intento fallido. */
export function RepartoApp({ driver }: { driver: string }) {
  const [mode, setMode] = useState<Mode>("cargar");
  const [pending, start] = useTransition();
  const [loads, setLoads] = useState<LoadItem[]>([]);
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

  const onLoad = (code: string) =>
    start(async () => {
      const r = await scanLoad(code);
      setLoads((l) => [
        r.ok
          ? { key: Date.now(), ok: true, text: r.info.tracking, sub: `${r.again ? "Ya estaba en ruta · " : ""}${r.info.destName} · ${r.info.borough} · Z${r.info.zone}` }
          : { key: Date.now(), ok: false, text: r.error },
        ...l,
      ]);
      if (!r.ok) notify("error", "No se cargó", r.error);
      else if (r.again) notify("repeat", "Ya estaba cargada", `${r.info.tracking} · ${r.info.destName}`);
      else notify("ok", "Cargada al vehículo", `${r.info.tracking} · ${r.info.borough} · Zona ${r.info.zone}`);
    });

  const onDeliverScan = (code: string) =>
    start(async () => {
      setError("");
      setDone("");
      const r = await lookupDelivery(code);
      if (r.ok) {
        setCurrent(r.info);
        notify("ok", "Guía encontrada", `${r.info.destName} · ${r.info.borough}`);
      } else {
        setError(r.error);
        notify(/ya fue entregada/.test(r.error) ? "repeat" : "error", /ya fue entregada/.test(r.error) ? "Ya estaba entregada" : "No se encontró", r.error);
      }
    });

  // Paquetes distintos cargados (un re-escaneo no suma)
  const loadedOk = new Set(loads.filter((l) => l.ok).map((l) => l.text)).size;

  return (
    <div className="mx-auto max-w-md space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-semibold">Reparto</h1>
        <p className="text-sm text-muted-foreground">{driver}</p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Modo">
        {(
          [
            ["cargar", "Cargar vehículo", Truck],
            ["entregar", "Entregar", PackageCheck],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setCurrent(null);
              setError("");
              setDone("");
            }}
            className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold", mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "cargar" ? (
        <>
          <Scanner onCode={onLoad} paused={pending} hint="Escanea cada paquete al subirlo al vehículo" />
          <section aria-live="polite" className="card overflow-hidden">
            <header className="flex items-center justify-between border-b px-4 py-2.5 text-sm">
              <span className="font-semibold">Cargados en esta sesión</span>
              <span key={loadedOk} className="rp-bump text-lg font-bold tabular-nums">{loadedOk}</span>
            </header>
            {loads.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Escanea el QR o el código de barras de cada guía.</p>
            ) : (
              <ul className="max-h-80 divide-y overflow-y-auto">
                {loads.map((l, i) => (
                  <li key={l.key} className={cn("flex items-start gap-2.5 px-4 py-2.5 text-sm", i === 0 && "rp-slide")}>
                    {l.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleX className="mt-0.5 size-4 shrink-0 text-rose-600" />}
                    <div className="min-w-0">
                      <div className={cn("font-medium", l.ok ? "font-mono" : "text-rose-700 dark:text-rose-300")}>{l.text}</div>
                      {l.sub && <div className="truncate text-xs text-muted-foreground">{l.sub}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : current ? (
        <Delivery
          info={current}
          onCancel={() => setCurrent(null)}
          onDone={(msg, kind, title) => {
            setCurrent(null);
            setDone(msg);
            notify(kind, title, msg);
          }}
          onError={(msg) => notify("error", "Falta algo", msg)}
        />
      ) : (
        <>
          {done && (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="size-5 shrink-0" /> {done}
            </p>
          )}
          <Scanner onCode={onDeliverScan} paused={pending} hint="Escanea la guía del paquete que vas a entregar" />
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
        </>
      )}
      <ScanFlash flash={flash} />
    </div>
  );
}

function Delivery({
  info,
  onCancel,
  onDone,
  onError,
}: {
  info: DeliveryInfo;
  onCancel: () => void;
  onDone: (msg: string, kind: Feedback, title: string) => void;
  onError: (msg: string) => void;
}) {
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
        setError("Pide la firma de quien recibe.");
        return onError("Pide la firma de quien recibe.");
      }
      if (!photo) {
        setError("Toma la foto de la entrega.");
        return onError("Toma la foto de la entrega.");
      }
      const fd = new FormData();
      fd.set("tracking", info.tracking);
      fd.set("receiverName", receiver);
      fd.set("signature", new File([signature], "firma.png", { type: "image/png" }));
      fd.set("photo", new File([photo.blob], "entrega.jpg", { type: "image/jpeg" }));
      const r = await confirmDelivery(fd);
      if (r.ok) onDone(`Guía ${r.tracking} entregada a ${receiver}.`, "delivered", "¡Entregado!");
      else {
        setError(r.error);
        onError(r.error);
      }
    });

  const sendFail = () =>
    start(async () => {
      setError("");
      const r = await failedAttempt(info.tracking, reason, note);
      if (r.ok) onDone(`Intento ${r.attempts} registrado para ${info.tracking}. El paquete sigue en ruta.`, "attempt", `Intento ${r.attempts} registrado`);
      else {
        setError(r.error);
        onError(r.error);
      }
    });

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{info.tracking}</p>
            <h2 className="text-lg font-semibold">{info.destName}</h2>
          </div>
          <span className="rounded-md bg-foreground px-2 py-1 text-xs font-bold text-background">Z{info.zone}</span>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {info.address}
        </p>
        {info.destRef && <p className="mt-1 pl-5.5 text-sm text-muted-foreground">Ref: {info.destRef}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a href={`tel:${info.destPhone}`} className="btn-secondary h-9 text-xs">
            <Phone className="size-3.5" /> Llamar
          </a>
          <span className="rounded-md bg-muted px-2 py-2">{info.packages} bulto(s)</span>
          <span className="rounded-md bg-muted px-2 py-2">{info.service}</span>
          {info.attempts > 0 && <span className="rounded-md bg-amber-100 px-2 py-2 text-amber-900">Intentos previos: {info.attempts}</span>}
        </div>
        {info.cod > 0 && <p className="mt-3 rounded-lg bg-foreground px-3 py-2 text-center text-sm font-bold text-background">COBRAR AL ENTREGAR {money(info.cod)}</p>}
      </section>

      {view === "entregar" ? (
        <section className="card space-y-4 p-4">
          <label className="block">
            <span className="label">¿Quién recibe?</span>
            <input value={receiver} onChange={(e) => setReceiver(e.target.value)} autoComplete="off" className="input h-11" />
          </label>
          <div>
            <span className="label">Firma de quien recibe</span>
            <SignaturePad ref={sig} onChange={(empty) => setSigned(!empty)} />
          </div>
          <div>
            <span className="label">Foto de la entrega</span>
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.url} alt="Foto de la entrega" className="mb-2 max-h-60 w-full rounded-xl object-cover" />
            )}
            <label className="btn-secondary h-11 w-full cursor-pointer">
              <Camera className="size-4" /> {photo ? "Tomar otra foto" : "Tomar foto"}
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
                    setError("No se pudo leer la foto. Intenta de nuevo.");
                  }
                }}
              />
            </label>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
          <button type="button" onClick={submit} disabled={pending} className="btn-kurier h-12 w-full text-base">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />} Confirmar entrega
          </button>
          <div className="flex justify-between">
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Undo2 className="size-4" /> Otra guía
            </button>
            <button type="button" onClick={() => setView("fallo")} className="text-sm font-medium text-rose-700 dark:text-rose-300">
              No se pudo entregar
            </button>
          </div>
        </section>
      ) : (
        <section className="card space-y-3 p-4">
          <h3 className="font-semibold">Intento sin entregar</h3>
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Motivo</legend>
            {FAIL_REASONS.map((r) => (
              <label key={r} className={cn("flex h-11 items-center gap-2 rounded-lg border px-3 text-sm", reason === r && "border-primary bg-primary/5")}>
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} /> {r}
              </label>
            ))}
          </fieldset>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={reason === "Otro" ? "¿Qué pasó? (obligatorio)" : "Comentario (opcional)"} className="input h-11" />
          {error && <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
          <button type="button" onClick={sendFail} disabled={pending || !reason} className="btn-danger h-12 w-full">
            {pending && <Loader2 className="size-4 animate-spin" />} Registrar intento {info.attempts + 1}
          </button>
          <button type="button" onClick={() => setView("entregar")} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Undo2 className="size-4" /> Regresar a entregar
          </button>
        </section>
      )}
    </div>
  );
}
