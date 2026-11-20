"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, Delete, LogIn, LogOut, Utensils, UtensilsCrossed } from "lucide-react";
import { kioskChangeType, kioskHeartbeat, kioskPunch, type KioskResult } from "@/app/actions/attendance";
import { cn } from "@/lib/utils";
import { Tr } from "@/components/Tr";
import { useT } from "@/components/I18nProvider";

const ICON = { ENTRADA: LogIn, SALIDA_COMIDA: Utensils, REGRESO_COMIDA: UtensilsCrossed, SALIDA: LogOut } as const;
const TONE = {
  ENTRADA: "bg-emerald-500",
  SALIDA_COMIDA: "bg-amber-500",
  REGRESO_COMIDA: "bg-sky-500",
  SALIDA: "bg-indigo-500",
} as const;

/** Pantalla del kiosco: el empleado solo escribe el código de 6 dígitos de su app. */
export function KioskScreen({ company, device, tz }: { company: string; device: string; tz: string }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<KioskResult | null>(null);
  // Cambia en cada resultado para reiniciar la animación (también al corregir el tipo)
  const [seq, setSeq] = useState(0);
  // El reloj se muestra hasta montar en el navegador (evita diferencias con el render del servidor)
  const [now, setNow] = useState<Date | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reloj y llamada periódica (cierra jornadas vencidas con la salida automática)
  useEffect(() => {
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 1000);
    const beat = setInterval(() => void kioskHeartbeat(), 60000);
    void kioskHeartbeat();
    return () => {
      clearInterval(clock);
      clearInterval(beat);
    };
  }, []);

  const showResult = useCallback((r: KioskResult) => {
    setResult(r);
    setSeq((n) => n + 1);
    codeRef.current = "";
    setCode("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult(null), r.ok ? 8000 : 5000);
  }, []);

  const submit = useCallback(
    (value: string) => {
      if (value.length !== 6 || pending) return;
      start(async () => showResult(await kioskPunch(value)));
    },
    [pending, showResult],
  );

  // Referencia al código actual: con teclado físico las teclas llegan más rápido que los renders
  const codeRef = useRef("");
  const setCodeBoth = useCallback((v: string) => {
    codeRef.current = v;
    setCode(v);
  }, []);
  const press = useCallback(
    (d: string) => {
      if (pending || codeRef.current.length >= 6) return;
      const next = codeRef.current + d;
      setCodeBoth(next);
      if (next.length === 6) submit(next);
    },
    [pending, submit, setCodeBoth],
  );

  // Teclado físico (si la tablet tiene uno)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setCodeBoth(codeRef.current.slice(0, -1));
      else if (e.key === "Escape") setCodeBoth("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, result]);

  const time = !now ? " " : now.toLocaleTimeString("es-MX", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = !now ? " " : now.toLocaleDateString("es-MX", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground select-none">
      <header className="flex shrink-0 items-center justify-between px-6 py-4 text-sm landscape:py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground">K</div>
          <div className="leading-tight">
            <div className="font-semibold">{company}</div>
            <div className="text-[11px] text-sidebar-foreground/60"><Tr>Registro de asistencia ·</Tr> {device}</div>
          </div>
        </div>
      </header>

      {/* Vertical: todo en columna. Horizontal (ej. Galaxy Tab A 11): reloj y código a la izquierda, teclado a la derecha */}
      <main className="grid min-h-0 flex-1 place-items-center px-4 pb-6 landscape:px-8 landscape:pb-4">
        {result ? (
          <ResultCard key={seq} result={result} onChange={(type) => result.ok && start(async () => showResult(await kioskChangeType(result.punchId, result.ticket, type)))} />
        ) : (
          <div className="flex w-full max-w-md flex-col items-center landscape:grid landscape:max-w-5xl landscape:grid-cols-2 landscape:items-center landscape:gap-x-12">
            <div className="flex flex-col items-center">
              <div className="text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl whitespace-nowrap landscape:text-[clamp(2.75rem,min(11dvh,5.2vw),5.5rem)]">{time}</div>
              <div className="mt-1 text-lg text-sidebar-foreground/70 first-letter:uppercase">{date}</div>
              <p className="mt-8 text-center text-base text-sidebar-foreground/80 landscape:mt-[4dvh]"><Tr>Escribe el código de 6 dígitos de tu app autenticadora</Tr></p>
              <div className="mt-4 flex gap-2" aria-live="polite" aria-label={t("{v0} de 6 dígitos", { v0: code.length })}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "grid size-12 place-items-center rounded-xl border-2 text-2xl font-semibold tabular-nums transition-[border-color,background-color,transform] duration-150 sm:size-14",
                      i < code.length ? "scale-105 border-sidebar-primary bg-white/10" : "border-white/20",
                    )}
                  >
                    {code[i] ?? ""}
                  </div>
                ))}
              </div>
              <p className={cn("mt-4 h-5 text-sm text-sidebar-foreground/70", !pending && "invisible")}><Tr>Verificando…</Tr></p>
            </div>
            <div className="mt-2 grid w-full max-w-xs grid-cols-3 gap-3 landscape:mt-0 landscape:max-w-sm landscape:justify-self-center">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <Key key={d} onClick={() => press(d)} disabled={pending}>
                  {d}
                </Key>
              ))}
              <Key onClick={() => setCodeBoth("")} disabled={pending} className="text-base text-sidebar-foreground/70">
                <Tr>Borrar</Tr>
              </Key>
              <Key onClick={() => press("0")} disabled={pending}>
                0
              </Key>
              <Key onClick={() => setCodeBoth(codeRef.current.slice(0, -1))} disabled={pending} aria-label={t("Borrar un dígito")}>
                <Delete className="size-7" />
              </Key>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Key({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "grid h-16 place-items-center rounded-2xl bg-white/10 text-3xl font-semibold transition-[background-color,transform] duration-100 active:scale-95 active:bg-white/25 disabled:opacity-50 sm:h-20",
        // En horizontal la altura de las teclas se ajusta a la pantalla para que el teclado quepa completo
        "landscape:h-[clamp(3.25rem,15dvh,5.5rem)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Animación del ícono según la checada: entrar, salir a comer, regresar de comer, salir. */
const MOTION = {
  ENTRADA: "kiosk-in",
  SALIDA_COMIDA: "kiosk-meal-out",
  REGRESO_COMIDA: "kiosk-meal-back",
  SALIDA: "kiosk-out",
} as const;
const RING = {
  ENTRADA: "bg-emerald-400",
  SALIDA_COMIDA: "bg-amber-400",
  REGRESO_COMIDA: "bg-sky-400",
  SALIDA: "bg-indigo-400",
} as const;

function ResultCard({ result, onChange }: { result: KioskResult; onChange: (type: string) => void }) {
  const t = useT();
  if (!result.ok) {
    return (
      <div className="kiosk-shake w-full max-w-md overflow-hidden rounded-3xl bg-card text-center text-card-foreground shadow-2xl">
        <div className="p-8">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-100 text-amber-700">
            <CircleAlert className="size-9" />
          </div>
          <p className="mt-4 text-lg font-medium"><Tr>{result.error}</Tr></p>
        </div>
        <div className="kiosk-timer h-1 origin-left bg-amber-500" style={{ animationDuration: "5s" }} />
      </div>
    );
  }
  const Icon = ICON[result.type];
  return (
    <div className="relative w-full max-w-md">
      {/* Onda de color detrás de la tarjeta */}
      <div aria-hidden className={cn("kiosk-ring pointer-events-none absolute inset-0 m-auto aspect-square w-3/4 rounded-full", RING[result.type])} />
      <div className="kiosk-pop relative overflow-hidden rounded-3xl bg-card text-card-foreground shadow-2xl">
        <div className={cn("flex items-center gap-4 px-6 py-5 text-white", TONE[result.type])}>
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15">
            <Icon className={cn("size-9", MOTION[result.type])} />
          </div>
          <div className="kiosk-rise" style={{ animationDelay: "120ms" }}>
            <div className="text-2xl font-semibold"><Tr>{result.label}</Tr></div>
            <div className="text-sm opacity-90"><Tr>Registrada a las</Tr> {result.time}</div>
          </div>
          <CircleCheck className="kiosk-check ml-auto size-10 opacity-95" />
        </div>
        <div className="p-6">
          <div className="kiosk-rise text-2xl font-semibold" style={{ animationDelay: "200ms" }}>{result.name}</div>
          <div className="kiosk-rise text-sm text-muted-foreground" style={{ animationDelay: "240ms" }}>{[result.position, result.area].filter(Boolean).join(" · ")}</div>
          <p
            className={cn("kiosk-rise mt-4 text-base", result.lateMin > 0 && result.type === "ENTRADA" && result.message.includes("tarde") ? "font-medium text-rose-700" : "")}
            style={{ animationDelay: "300ms" }}
          >
            {result.message}
          </p>
          {result.alternatives.length > 0 && (
            <div className="kiosk-rise mt-5 border-t pt-4" style={{ animationDelay: "380ms" }}>
              <div className="text-xs text-muted-foreground"><Tr>¿No era</Tr> {t(result.label).toLowerCase()}<Tr>? Cambiar a:</Tr></div>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.alternatives.map((a) => (
                  <button key={a.type} type="button" onClick={() => onChange(a.type)} className="btn-secondary h-10">
                    <Tr>{a.label}</Tr>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Tiempo que queda antes de volver al teclado */}
        <div className={cn("kiosk-timer h-1 origin-left", TONE[result.type])} style={{ animationDuration: "8s" }} />
      </div>
    </div>
  );
}
