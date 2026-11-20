import { cookies } from "next/headers";
import { getSession } from "@/lib/current-user";
import { isLang, LANG_COOKIE, translator, type Lang } from "./index";
import { setRequestLang } from "@/lib/request-lang";

/** Idioma activo: cookie elegida por el usuario → idioma de su perfil → español. */
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  const session = isLang(c) ? null : await getSession();
  const lang: Lang = isLang(c) ? c : isLang(session?.user?.locale) ? session.user.locale : "es";
  setRequestLang(lang); // para que las fechas del servidor salgan en el mismo idioma
  return lang;
}

export async function getT() {
  return translator(await getLang());
}
