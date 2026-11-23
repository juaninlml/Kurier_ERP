"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export type SignatureHandle = { toBlob: () => Promise<Blob | null>; isEmpty: () => boolean; clear: () => void };

/** Recuadro para firmar con el dedo (o stylus). Exporta la firma como PNG con fondo blanco. */
export const SignaturePad = forwardRef<SignatureHandle, { onChange?: (empty: boolean) => void }>(function SignaturePad({ onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const setup = () => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  };
  useEffect(setup, []);

  const clear = () => {
    setup();
    setEmpty(true);
    onChange?.(true);
  };
  useImperativeHandle(ref, () => ({
    toBlob: () => new Promise((res) => canvas.current!.toBlob((b) => res(b), "image/png")),
    isEmpty: () => empty,
    clear,
  }));

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvas}
          aria-label="Recuadro de firma"
          className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-input bg-white"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const ctx = canvas.current!.getContext("2d")!;
            const [x, y] = point(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 0.1, y + 0.1);
            ctx.stroke();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvas.current!.getContext("2d")!;
            const [x, y] = point(e);
            ctx.lineTo(x, y);
            ctx.stroke();
            if (empty) {
              setEmpty(false);
              onChange?.(false);
            }
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
        {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">Firma aquí</span>}
      </div>
      <button type="button" onClick={clear} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
        <Eraser className="size-3.5" /> Borrar firma
      </button>
    </div>
  );
});
