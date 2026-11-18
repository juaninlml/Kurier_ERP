"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { CircleAlert } from "lucide-react";
import type { ActionResult } from "@/lib/safe-action";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
}: {
  action: (fd: FormData) => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        setError(null);
        start(async () => {
          try {
            const r = (await action(fd)) as ActionResult;
            if (r && "error" in r) setError(r.error);
          } catch {
            setError("No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.");
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
        {children}
      </PendingContext.Provider>
    </form>
  );
}
