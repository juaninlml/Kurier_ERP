"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { useLang } from "./I18nProvider";
import { setLanguage } from "@/app/actions/account";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { LANGS, LANG_NAMES } from "@/lib/i18n/core";

/** Selector Español / English / 中文 (guarda la preferencia en una cookie y en el perfil). */
export function LanguageSwitch({ dark }: { dark?: boolean }) {
  const t = useT();
  const lang = useLang();
  const [pending, start] = useTransition();
  // Cada idioma se muestra con su propio nombre (así lo reconoce quien no lee el idioma actual)
  const options = LANGS.map((v) => [v, LANG_NAMES[v].short, LANG_NAMES[v].name] as const);
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg p-1 text-xs", dark ? "bg-white/10 text-white" : "bg-muted")} role="radiogroup" aria-label={t("Idioma / Language")}>
      <Languages className="mx-1 size-3.5 opacity-70" aria-hidden />
      {options.map(([v, label, name]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={lang === v}
          aria-label={name}
          lang={v}
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
