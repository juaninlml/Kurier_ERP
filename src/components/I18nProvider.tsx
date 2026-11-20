"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translator, type Lang, type T } from "@/lib/i18n";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

type Ctx = { lang: Lang; t: T; theme: Theme; setTheme: (t: Theme) => void };
const I18nCtx = createContext<Ctx>({ lang: "es", t: translator("es"), theme: "light", setTheme: () => {} });

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Aplica el tema en <html> al momento (sin recargar ni esperar al servidor). */
function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Idioma y tema de la interfaz. */
export function I18nProvider({ lang, theme: initial = "light", children }: { lang: Lang; theme?: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    applyTheme(next);
  }, []);

  // Con "sistema", sigue los cambios del sistema operativo (ej. modo oscuro automático al anochecer)
  useEffect(() => {
    if (theme !== "system") return;
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [theme]);

  const value = useMemo(() => ({ lang, t: translator(lang), theme, setTheme }), [lang, theme, setTheme]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useT = () => useContext(I18nCtx).t;
export const useLang = () => useContext(I18nCtx).lang;
export const useTheme = () => {
  const { theme, setTheme } = useContext(I18nCtx);
  return { theme, setTheme };
};
