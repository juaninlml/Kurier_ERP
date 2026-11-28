import { en as enBase } from "./en";
import { enModules } from "./en-modules";
import { makeTranslator, type Lang, type Messages, type T } from "./core";

export { LANGS, LANG_COOKIE, isLang, localeOf, makeTranslator, type Lang, type Messages, type T } from "./core";

/** Diccionario completo (base + módulos). Solo en el servidor: los componentes del navegador usan ./core. */
const en: Messages = { ...enModules, ...enBase };

/** Diccionario que necesita el navegador para un idioma (el español no necesita ninguno). */
export const messagesFor = (lang: Lang): Messages | undefined => (lang === "en" ? en : undefined);

/**
 * Traducción: el texto en español es la clave. Si no hay traducción al inglés se muestra en español.
 * Variables: t("Hola {name}", { name: "Ana" }).
 */
export function translator(lang: Lang): T {
  return makeTranslator(lang, messagesFor(lang));
}
