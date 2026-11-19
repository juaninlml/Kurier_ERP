"use client";

import { createContext, useContext, useMemo } from "react";
import { translator, type Lang, type T } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; t: T }>({ lang: "es", t: translator("es") });

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: translator(lang) }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLang = () => useContext(Ctx).lang;
