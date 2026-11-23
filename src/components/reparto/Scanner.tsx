"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanBarcode } from "lucide-react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Escáner de guías. Solo acepta dos fuentes (no se puede escribir la guía a mano):
 *  1. La cámara trasera con el lector nativo del navegador (BarcodeDetector: Chrome en Android).
 *  2. El escáner del PDA o una pistola lectora en modo teclado: "teclean" el código muy rápido y dan Enter.
 *     Se distingue de una persona por la velocidad: todas las teclas llegan con menos de SCAN_GAP ms entre sí.
 */
const SCAN_GAP = 50; // ms máximos entre caracteres de un escáner (una persona tarda más de 80–100 ms)
const MIN_LEN = 8;
export function Scanner({ onCode, paused, hint }: { onCode: (code: string) => void; paused?: boolean; hint?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(true);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const last = useRef({ code: "", at: 0 });
  const cb = useRef(onCode);
  cb.current = onCode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Escáner en modo teclado: junta la ráfaga de teclas y la acepta solo si llegó a velocidad de escáner
  useEffect(() => {
    let buf = "";
    let lastAt = 0;
    let human = false;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const now = performance.now();
      if (now - lastAt > 300) {
        buf = "";
        human = false;
      } else if (buf && now - lastAt > SCAN_GAP) human = true;
      lastAt = now;
      if (e.key === "Enter") {
        const code = buf.trim();
        buf = "";
        if (code.length >= MIN_LEN) {
          e.preventDefault();
          if (human) setNotice("La guía no se puede escribir a mano: usa el escáner o la cámara.");
          else if (!pausedRef.current) {
            setNotice("");
            navigator.vibrate?.(80);
            cb.current(code);
          }
        }
        human = false;
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) buf += e.key;
    };
    // Tampoco se puede pegar un código
    const noPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("paste", noPaste, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("paste", noPaste, true);
    };
  }, []);

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    setSupported(!!Ctor);
    if (!Ctor || !on) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const detector = new Ctor({ formats: ["qr_code", "code_128"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setError("");
        const tick = async () => {
          if (stopped) return;
          if (!pausedRef.current && v.readyState >= 2) {
            try {
              const found = await detector.detect(v);
              const code = found[0]?.rawValue;
              // El mismo código no se repite en 3 segundos (evita dobles escaneos)
              if (code && (code !== last.current.code || Date.now() - last.current.at > 3000)) {
                last.current = { code, at: Date.now() };
                navigator.vibrate?.(80);
                cb.current(code);
              }
            } catch {}
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch {
        setError("No se pudo abrir la cámara. Revisa el permiso de cámara del navegador para este sitio.");
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on]);

  return (
    <div className="space-y-3">
      {supported && on && (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" />
          {/* Marco de enfoque */}
          <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          {paused && <div className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-medium text-white">Procesando…</div>}
          {hint && !paused && <p className="absolute right-0 bottom-2 left-0 text-center text-xs font-medium text-white drop-shadow">{hint}</p>}
        </div>
      )}
      {notice && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{error}</p>}
      {supported === false && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Este navegador no puede leer códigos con la cámara (en iPhone pasa con Safari). Usa el escáner del PDA o una pistola lectora.
        </p>
      )}
      <div className="flex items-center gap-2">
        <p className="flex flex-1 items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground" aria-live="polite">
          <ScanBarcode className="size-5 shrink-0 text-primary" aria-hidden />
          {paused ? "Procesando…" : "Lector listo: dispara el escáner o apunta la cámara a la guía."}
        </p>
        {supported && (
          <button type="button" onClick={() => setOn((x) => !x)} aria-label={on ? "Apagar cámara" : "Encender cámara"} className="btn-secondary h-11 px-3">
            {on ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
