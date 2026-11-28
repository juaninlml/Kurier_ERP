import { en as enBase } from "./en";
import { enModules } from "./en-modules";
import { enPdf } from "./en-pdf";
import { zh as zhBase } from "./zh";
import { zhModules } from "./zh-modules";
import { zhPdf } from "./zh-pdf";
import { makeTranslator, type Lang, type Messages, type T } from "./core";

export { LANGS, LANG_COOKIE, LANG_NAMES, isLang, localeOf, makeTranslator, type Lang, type Messages, type T } from "./core";

/** Diccionarios completos (base + módulos). Solo en el servidor: los componentes del navegador usan ./core. */
const en: Messages = { ...enModules, ...enBase };
/** Chino simplificado; lo que falte se muestra en inglés (más legible que el español para quien lee chino). */
const zh: Messages = { ...en, ...zhModules, ...zhBase };

/** Diccionario que necesita el navegador para un idioma (el español no necesita ninguno). */
export const messagesFor = (lang: Lang): Messages | undefined => (lang === "en" ? en : lang === "zh" ? zh : undefined);

/** En el servidor también los textos de los PDF (no viajan al navegador). */
const enServer: Messages = { ...enPdf, ...en };
const zhServer: Messages = { ...enPdf, ...en, ...zhPdf, ...zhModules, ...zhBase };

/**
 * Traducción: el texto en español es la clave. Si no hay traducción se muestra en español.
 * Variables: t("Hola {name}", { name: "Ana" }).
 */
export function translator(lang: Lang): T {
  return makeTranslator(lang, lang === "en" ? enServer : lang === "zh" ? zhServer : undefined);
}
