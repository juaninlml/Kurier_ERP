import { cache } from "react";

/**
 * Idioma de la petición actual para los formatos de fecha del servidor.
 * `getLang()` lo guarda al resolver el idioma; con `cache` vive solo durante esa petición
 * (dos usuarios con idiomas distintos no se mezclan). Si nadie lo ha fijado, es español.
 */
const store = cache(() => ({ lang: "es" as "es" | "en" }));

export const setRequestLang = (lang: "es" | "en") => {
  store().lang = lang;
};
export const requestLang = () => store().lang;
export const requestLocale = () => (store().lang === "en" ? "en-US" : "es-MX");
