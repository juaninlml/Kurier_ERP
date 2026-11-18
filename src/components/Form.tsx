"use client";

import { createContext, useContext, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/safe-action";

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
          <div role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
        {children}
      </PendingContext.Provider>
    </form>
  );
}
