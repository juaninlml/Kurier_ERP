"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard } from "lucide-react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Escáner de guías: usa la cámara trasera con el lector nativo del navegador (BarcodeDetector: Chrome en
 * Android) para el QR y el código de barras. Siempre hay un campo para escribir la guía o usar un lector
 * de códigos (los lectores "escriben" el código y dan Enter).
 */
export function Scanner({ onCode, paused, hint }: { onCode: (code: string) => void; paused?: boolean; hint?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(true);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [manual, setManual] = useState("");
  const last = useRef({ code: "", at: 0 });
  const cb = useRef(onCode);
  cb.current = onCode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

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
      {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{error}</p>}
      {supported === false && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Este navegador no puede leer códigos con la cámara (en iPhone pasa con Safari). Escribe la guía abajo o usa un lector de códigos.
        </p>
      )}
      <div className="flex items-center gap-2">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) cb.current(manual.trim());
            setManual("");
          }}
        >
          <label htmlFor="manual-code" className="sr-only">
            Número de guía
          </label>
          <div className="relative flex-1">
            <Keyboard aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input id="manual-code" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="LM-XXXX-XXXX" autoComplete="off" className="input h-11 pl-9 font-mono uppercase" />
          </div>
          <button type="submit" className="btn-secondary h-11" disabled={paused}>
            OK
          </button>
        </form>
        {supported && (
          <button type="button" onClick={() => setOn((x) => !x)} aria-label={on ? "Apagar cámara" : "Encender cámara"} className="btn-secondary h-11 px-3">
            {on ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
