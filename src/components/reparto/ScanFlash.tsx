"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, PackageCheck, Repeat2, X } from "lucide-react";
import type { Feedback } from "./feedback";
import { cn } from "@/lib/utils";

export type Flash = { kind: Feedback; title: string; sub?: string; seq: number };

const STYLE: Record<Feedback, { tint: string; circle: string; ring: string; icon: typeof Check; ms: number }> = {
  ok: { tint: "bg-emerald-500/25", circle: "bg-emerald-600", ring: "bg-emerald-500", icon: Check, ms: 1100 },
  repeat: { tint: "bg-amber-400/25", circle: "bg-amber-500", ring: "bg-amber-400", icon: Repeat2, ms: 1400 },
  error: { tint: "bg-rose-500/30", circle: "bg-rose-600", ring: "bg-rose-500", icon: X, ms: 1700 },
  delivered: { tint: "bg-emerald-500/30", circle: "bg-emerald-600", ring: "bg-emerald-500", icon: PackageCheck, ms: 2000 },
  attempt: { tint: "bg-amber-400/25", circle: "bg-amber-500", ring: "bg-amber-400", icon: AlertTriangle, ms: 1800 },
};

/**
 * Aviso a pantalla completa después de cada escaneo: color + ícono grande + texto, para que el repartidor
 * sepa de un vistazo si se aceptó, si ya estaba escaneada o si hubo error. Se quita solo; no bloquea toques.
 */
export function ScanFlash({ flash }: { flash: Flash | null }) {
  const [shown, setShown] = useState<Flash | null>(null);
  useEffect(() => {
    if (!flash) return;
    setShown(flash);
    const t = setTimeout(() => setShown(null), STYLE[flash.kind].ms);
    return () => clearTimeout(t);
  }, [flash]);
  if (!shown) return null;
  const st = STYLE[shown.kind];
  const Icon = st.icon;
  return (
    <div key={shown.seq} role="status" aria-live="assertive" className="pointer-events-none fixed inset-0 z-[70] grid place-items-center p-6">
      <div className={cn("rp-tint absolute inset-0", st.tint)} style={{ animationDuration: `${st.ms}ms` }} />
      <div className="rp-card relative w-full max-w-xs" style={{ animationDuration: `${st.ms}ms` }}>
      <div className={cn("flex flex-col items-center rounded-3xl bg-card px-6 py-7 text-center shadow-2xl", shown.kind === "error" && "kiosk-shake")}>
        <div className="relative grid size-24 place-items-center">
          <span aria-hidden className={cn("kiosk-ring absolute inset-0 rounded-full", st.ring)} />
          <span className={cn("relative grid size-24 place-items-center rounded-full text-white shadow-lg", st.circle)}>
            <Icon className={cn("size-12", shown.kind !== "error" && "kiosk-check")} strokeWidth={2.6} />
          </span>
        </div>
        <p className="mt-4 text-xl leading-tight font-bold">{shown.title}</p>
        {shown.sub && <p className="mt-1 text-sm text-muted-foreground">{shown.sub}</p>}
      </div>
      </div>
    </div>
  );
}
