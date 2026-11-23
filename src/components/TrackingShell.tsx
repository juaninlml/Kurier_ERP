import { Search } from "lucide-react";
import { KidoMark } from "./KidoLogo";
import { cn } from "@/lib/utils";

/** Marco de la página pública de rastreo (cubre la pantalla aunque haya sesión iniciada). */
export function TrackingShell({ children, contact }: { children: React.ReactNode; contact?: string }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-muted/40">
      <header className="bg-sidebar px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-2.5">
          <KidoMark className="size-9 shrink-0" />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight">
              kurier <span className="text-[#FF6A2B]">kido</span>
            </p>
            <p className="text-[11px] text-white/70">Rastreo de envíos · CDMX</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">{children}</div>
        {contact && <p className="mt-4 text-center text-xs text-muted-foreground">¿Dudas sobre tu entrega? {contact}</p>}
      </main>
    </div>
  );
}

/** Buscador de guía (formulario GET a /rastreo, que redirige a la guía). */
export function TrackingSearch({ className }: { className?: string }) {
  return (
    <form action="/rastreo" className={cn("flex gap-2", className)}>
      <label className="sr-only" htmlFor="guia">
        Número de guía
      </label>
      <input id="guia" name="guia" required placeholder="LM-XXXX-XXXX" autoComplete="off" className="input h-10 flex-1 font-mono uppercase" />
      <button type="submit" className="btn-primary h-10">
        <Search className="size-4" /> Rastrear
      </button>
    </form>
  );
}
