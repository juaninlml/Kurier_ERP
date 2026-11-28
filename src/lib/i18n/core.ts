/**
 * Lo básico del idioma, sin los diccionarios: lo usan los componentes del navegador.
 * Los diccionarios (en*.ts, zh*.ts) no se incluyen aquí para que no viajen en el JavaScript de
 * todas las páginas; el servidor manda a I18nProvider solo el del idioma activo.
 */
export type Lang = "es" | "en" | "zh";
export const LANGS: Lang[] = ["es", "en", "zh"];
export const LANG_COOKIE = "kurier_lang";
export const isLang = (v: unknown): v is Lang => v === "es" || v === "en" || v === "zh";

/** Nombre de cada idioma escrito en ese idioma (para los selectores) y su abreviatura. */
export const LANG_NAMES: Record<Lang, { name: string; short: string }> = {
  es: { name: "Español", short: "ES" },
  en: { name: "English", short: "EN" },
  zh: { name: "简体中文", short: "中文" },
};

export type T = (text: string, vars?: Record<string, string | number>) => string;
export type Messages = Record<string, string>;

/**
 * Traducción: el texto en español es la clave. Si no hay traducción se muestra en español.
 * Variables: t("Hola {name}", { name: "Ana" }).
 */
export function makeTranslator(lang: Lang, messages?: Messages): T {
  return (text, vars) => {
    let out = lang !== "es" && messages ? (messages[text] ?? text) : text;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}

/** Configuración regional para fechas y números. */
export const localeOf = (lang: Lang) => (lang === "en" ? "en-US" : lang === "zh" ? "zh-CN" : "es-MX");
