"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import type { ActionResult } from "@/lib/safe-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useT } from "./I18nProvider";

const PendingContext = createContext(false);
export const useFormPending = () => useContext(PendingContext);

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
}: {
  action: (fd: FormData) => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  /** Limpia los campos cuando la acción termina sin error (formularios de alta). */
  resetOnSuccess?: boolean;
  /** Mensaje que se muestra unos segundos cuando la acción termina sin error (formularios de edición). */
  successMessage?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const t = useT();
  const [pending, start] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const formEl = e.currentTarget;
        const fd = new FormData(formEl, submitter);
        setError(null);
        setSaved(false);
        start(async () => {
          try {
            const r = (await action(fd)) as ActionResult;
            if (r && "error" in r) setError(t(r.error));
            else {
              if (resetOnSuccess) formEl.reset();
              if (successMessage) {
                setSaved(true);
                setTimeout(() => setSaved(false), 4000);
              }
            }
          } catch {
            setError(t("No se pudo completar la operación. Revisa tu conexión e intenta de nuevo."));
          }
        });
      }}
    >
      <PendingContext.Provider value={pending}>
        {error && (
          <Alert variant="destructive" className="mb-4 border-destructive/30 bg-destructive/5">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {saved && successMessage && (
          <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800">
            <CircleCheck />
            <AlertDescription className="text-emerald-800">{t(successMessage)}</AlertDescription>
          </Alert>
        )}
        {children}
      </PendingContext.Provider>
    </form>
  );
}
