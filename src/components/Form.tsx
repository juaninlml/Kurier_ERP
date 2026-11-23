"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { CircleAlert } from "lucide-react";
import type { ActionResult } from "@/lib/safe-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useT } from "./I18nProvider";
import { SessionCurtain } from "./SessionCurtain";
import { DOOR_COVERED_MS, stampDoor, type Door } from "@/lib/session-ui";

const PendingContext = createContext(false);
export const useFormPending = () => useContext(PendingContext);

/** Cuánto se queda visible el aviso de "guardado". */
const TOAST_MS = 3800;

/**
 * Next.js "rechaza" la promesa de una server action cuando ésta redirige (login correcto, alta que
 * lleva al detalle…). No es un error: la navegación ya está en curso.
 */
function isNavigation(e: unknown) {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND");
}

/**
 * Formulario que llama una server action y muestra su mensaje de error (si lo hay)
 * sin perder lo capturado. Úsalo en lugar de <form action={…}>.
 */
export function Form({
  action,
  children,
  className,
  resetOnSuccess,
  successMessage,
  session,
}: {
  action: (fd: FormData) => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  /** Limpia los campos cuando la acción termina sin error (formularios de alta). */
  resetOnSuccess?: boolean;
  /** Mensaje que se muestra unos segundos cuando la acción termina sin error (formularios de edición). */
  successMessage?: string;
  /** Login: si la acción redirige al ERP, sube la cortina de entrada (ver SessionCurtain). */
  session?: "in";
}) {
  const [error, setError] = useState<string | null>(null);
  // Cada guardado tiene su propio número: así el aviso se reinicia aunque se guarde dos veces seguidas.
  const [saved, setSaved] = useState<number | null>(null);
  // Tras una redirección el botón sigue en "Guardando…" hasta que llega la otra página.
  const [leaving, setLeaving] = useState(false);
  const [door, setDoor] = useState<Door | null>(null);
  const t = useT();
  const [pending, start] = useTransition();
  const notice = successMessage ?? (resetOnSuccess ? "Registro agregado." : null);

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const formEl = e.currentTarget;
        const fd = new FormData(formEl, submitter);
        setError(null);
        start(async () => {
          try {
            const r = (await action(fd)) as ActionResult;
            if (r && "error" in r) setError(t(r.error));
            else if (session) {
              // Login correcto: sube la cortina sobre el login y, ya cubierto, se abre el ERP.
              // (Recarga completa: así el layout llega con la sesión; la cortina continúa por sessionStorage.)
              const next = String(fd.get("next") ?? "/");
              const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
              setDoor(stampDoor(session));
              setLeaving(true);
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              setTimeout(() => window.location.assign(safeNext), reduce ? 200 : DOOR_COVERED_MS);
            } else {
              if (resetOnSuccess) formEl.reset();
              if (notice) setSaved(Date.now());
            }
          } catch (err) {
            if (isNavigation(err)) {
              setLeaving(true);
              return;
            }
            setError(t("No se pudo completar la operación. Revisa tu conexión e intenta de nuevo."));
          }
        });
      }}
    >
      <PendingContext.Provider value={pending || leaving}>
        {error && (
          <Alert variant="destructive" className="form-alert mb-4 border-destructive/30 bg-destructive/5">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {children}
      </PendingContext.Provider>
      {leaving && session && <SessionCurtain phase="cover" label={t("Entrando al ERP…")} door={door} portal />}
      {saved !== null && notice && <SavedToast key={saved} message={t(notice)} onDone={() => setSaved(null)} />}
    </form>
  );
}

/**
 * Aviso flotante de "guardado": entra desde abajo, la palomita se dibuja y una línea marca el tiempo
 * que le queda. No empuja el contenido de la página (va fijo, fuera del flujo).
 */
function SavedToast({ message, onDone }: { message: string; onDone: () => void }) {
  const [closing, setClosing] = useState(false);
  // onDone solo limpia el estado del formulario: basta con la versión del primer render.
  const [done] = useState(() => onDone);

  useEffect(() => {
    const a = setTimeout(() => setClosing(true), TOAST_MS);
    const b = setTimeout(done, TOAST_MS + 180);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [done]);

  return createPortal(
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6">
      <div data-closing={closing || undefined} className="save-toast pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-xl border bg-popover py-3 pr-5 pl-3 text-sm text-popover-foreground shadow-lg">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path className="save-toast-check" d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
          </svg>
        </span>
        <span className="font-medium">{message}</span>
        <span className="save-toast-timer absolute inset-x-0 bottom-0 h-0.5 origin-left bg-emerald-500/50" style={{ animationDuration: `${TOAST_MS}ms` }} aria-hidden />
      </div>
    </div>,
    document.body,
  );
}
