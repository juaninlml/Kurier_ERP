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
    <div className="fixed inset-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground select-none">
      <header className="flex items-center justify-between px-6 py-4 text-sm">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground">K</div>
          <div className="leading-tight">
            <div className="font-semibold">{company}</div>
            <div className="text-[11px] text-sidebar-foreground/60"><Tr>Registro de asistencia ·</Tr> {device}</div>
          </div>
        </div>
      </header>

      <main className="grid flex-1 place-items-center px-4 pb-8">
        {result ? (
          <ResultCard result={result} onChange={(type) => result.ok && start(async () => showResult(await kioskChangeType(result.punchId, result.ticket, type)))} />
        ) : (
          <div className="flex w-full max-w-md flex-col items-center">
            <div className="text-6xl font-semibold tracking-tight tabular-nums sm:text-7xl">{time}</div>
            <div className="mt-1 text-lg text-sidebar-foreground/70 capitalize">{date}</div>
            <p className="mt-8 text-center text-base text-sidebar-foreground/80"><Tr>Escribe el código de 6 dígitos de tu app autenticadora</Tr></p>
            <div className="mt-4 flex gap-2" aria-live="polite" aria-label={t("{v0} de 6 dígitos", { v0: code.length })}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid size-12 place-items-center rounded-xl border-2 text-2xl font-semibold tabular-nums sm:size-14",
                    i < code.length ? "border-sidebar-primary bg-white/10" : "border-white/20",
                  )}
                >
                  {code[i] ?? ""}
                </div>
              ))}
            </div>
            <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-3">
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
            {pending && <p className="mt-4 text-sm text-sidebar-foreground/70"><Tr>Verificando…</Tr></p>}
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
      className={cn("grid h-16 place-items-center rounded-2xl bg-white/10 text-3xl font-semibold transition-colors active:bg-white/25 disabled:opacity-50 sm:h-20", className)}
      {...props}
    >
      {children}
    </button>
  );
}

function ResultCard({ result, onChange }: { result: KioskResult; onChange: (type: string) => void }) {
  const t = useT();
  if (!result.ok) {
    return (
      <div className="w-full max-w-md rounded-3xl bg-card p-8 text-center text-card-foreground shadow-2xl">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-100 text-amber-700">
          <CircleAlert className="size-9" />
        </div>
        <p className="mt-4 text-lg font-medium"><Tr>{result.error}</Tr></p>
      </div>
    );
  }
  const Icon = ICON[result.type];
  return (
    <div className="w-full max-w-md overflow-hidden rounded-3xl bg-card text-card-foreground shadow-2xl">
      <div className={cn("flex items-center gap-3 px-6 py-5 text-white", TONE[result.type])}>
        <Icon className="size-9" />
        <div>
          <div className="text-2xl font-semibold"><Tr>{result.label}</Tr></div>
          <div className="text-sm opacity-90"><Tr>Registrada a las</Tr> {result.time}</div>
        </div>
        <CircleCheck className="ml-auto size-9 opacity-90" />
      </div>
      <div className="p-6">
        <div className="text-2xl font-semibold">{result.name}</div>
        <div className="text-sm text-muted-foreground">{[result.position, result.area].filter(Boolean).join(" · ")}</div>
        <p className={cn("mt-4 text-base", result.lateMin > 0 && result.type === "ENTRADA" && result.message.includes("tarde") ? "font-medium text-rose-700" : "")}>{result.message}</p>
        {result.alternatives.length > 0 && (
          <div className="mt-5 border-t pt-4">
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
    </div>
  );
}
