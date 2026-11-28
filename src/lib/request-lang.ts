import { cache } from "react";
import { localeOf, type Lang } from "@/lib/i18n/core";

/**
 * Idioma de la petición actual para los formatos de fecha del servidor.
 * `getLang()` lo guarda al resolver el idioma; con `cache` vive solo durante esa petición
 * (dos usuarios con idiomas distintos no se mezclan). Si nadie lo ha fijado, es español.
 */
const store = cache(() => ({ lang: "es" as Lang }));

export const setRequestLang = (lang: Lang) => {
  store().lang = lang;
};
export const requestLang = () => store().lang;
export const requestLocale = () => localeOf(store().lang);
