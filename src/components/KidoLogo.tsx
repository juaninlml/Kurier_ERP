import { Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";

const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });

/** Colores del logo Kurier Kido: núcleo naranja y espacio azul marino. */
export const KIDO_ACCENT = "#FF6A2B";
export const KIDO_NAVY = "#0E1B3D";

/**
 * Símbolo Kurier Kido (núcleo con órbita y satélite) para fondos oscuros: la órbita va en blanco
 * y pasa por detrás y por delante del núcleo. `ring` = color del fondo (separa el núcleo de la órbita).
 */
export function KidoMark({ className, ring = "var(--sidebar)" }: { className?: string; ring?: string }) {
  return (
    <svg viewBox="-32 -32 64 64" className={className} role="img" aria-label="Kurier Kido" data-kido-mark="">
      <circle r="30" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.35" />
      <path d="M -25.3 6.6 A 26 9.5 -22 0 1 25.3 -6.6" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
      <circle r="10.5" fill={KIDO_ACCENT} stroke={ring} strokeWidth="2.5" />
      <path d="M 25.3 -6.6 A 26 9.5 -22 0 1 -25.3 6.6" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="21.5" cy="5.6" r="4.6" fill="#FFFFFF" stroke={ring} strokeWidth="1.6" />
      <circle cx="-18" cy="-24" r="2.4" fill={KIDO_ACCENT} />
    </svg>
  );
}

/** Logo completo para el login: símbolo + "kurier kido" + apartado ERP. */
export function KidoLogo({ className, textClassName }: { className?: string; /** Clase para el nombre (el símbolo queda quieto). */ textClassName?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 text-white", className)}>
      <KidoMark className="size-20" />
      <div className={cn("flex flex-col items-center gap-2", textClassName)}>
        <p className={cn(grotesk.className, "m-0 text-4xl leading-[0.9] font-bold tracking-[-0.045em]")}>
          kurier <span style={{ color: KIDO_ACCENT }}>kido</span>
        </p>
        <div className="flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.18em] text-white/70">
          <span className="h-px w-6 bg-white/30" aria-hidden="true" />
          <span>ERP</span>
          <span className="size-1.5 rounded-full" style={{ background: KIDO_ACCENT }} aria-hidden="true" />
          <span className="font-medium tracking-[0.12em] text-white/55">Fulfillment · CDMX</span>
          <span className="h-px w-6 bg-white/30" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/** Logo compacto (barra lateral, kiosco): símbolo + "kurier kido" + línea secundaria. */
export function KidoBrand({ sub, className }: { sub: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <KidoMark className="size-9 shrink-0" />
      <div className="min-w-0 leading-tight">
        <div className={cn(grotesk.className, "text-[17px] leading-none font-bold tracking-[-0.04em] text-white")}>
          kurier <span style={{ color: KIDO_ACCENT }}>kido</span>
        </div>
        <div className="mt-1 truncate text-[11px] text-sidebar-foreground/60">{sub}</div>
      </div>
    </div>
  );
}
