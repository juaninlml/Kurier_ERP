"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { useLang } from "./I18nProvider";
import { setLanguage } from "@/app/actions/account";
import { cn } from "@/lib/utils";

/** Selector Español / English (guarda la preferencia en una cookie y en el perfil). */
export function LanguageSwitch({ dark }: { dark?: boolean }) {
  const lang = useLang();
  const [pending, start] = useTransition();
  const options = [
    ["es", "ES", "Español"],
    ["en", "EN", "English"],
  ] as const;
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg p-1 text-xs", dark ? "bg-white/10 text-white" : "bg-muted")} role="radiogroup" aria-label="Idioma / Language">
      <Languages className="mx-1 size-3.5 opacity-70" aria-hidden />
      {options.map(([v, label, name]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={lang === v}
          aria-label={name}
          disabled={pending}
          onClick={() => start(async () => void (await setLanguage(v)))}
          className={cn(
            "h-6 rounded-md px-2 font-medium transition-colors",
            lang === v ? (dark ? "bg-white text-sidebar" : "bg-background shadow-xs") : dark ? "text-white/70 hover:text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
