import { en } from "./en";

export type Lang = "es" | "en";
export const LANGS: Lang[] = ["es", "en"];
export const LANG_COOKIE = "kurier_lang";
export const isLang = (v: unknown): v is Lang => v === "es" || v === "en";

export type T = (text: string, vars?: Record<string, string | number>) => string;

/**
 * Traducción: el texto en español es la clave. Si no hay traducción al inglés se muestra en español.
 * Variables: t("Hola {name}", { name: "Ana" }).
 */
export function translator(lang: Lang): T {
  return (text, vars) => {
    let out = lang === "en" ? (en[text] ?? text) : text;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}

/** Configuración regional para fechas y números. */
export const localeOf = (lang: Lang) => (lang === "en" ? "en-US" : "es-MX");
