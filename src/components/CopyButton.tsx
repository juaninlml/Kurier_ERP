"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useT } from "./I18nProvider";

/** Copia un texto (ej. link de invitación) al portapapeles. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  const t = useT();
  return (
    <button
      type="button"
      className="btn-secondary h-8 shrink-0 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt(t("Copia el link:"), value);
        }
      }}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? t("Copiado") : (label ?? t("Copiar link"))}
    </button>
  );
}
