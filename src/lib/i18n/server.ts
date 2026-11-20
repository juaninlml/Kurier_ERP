import { cookies } from "next/headers";
import { getSession } from "@/lib/current-user";
import { isLang, LANG_COOKIE, translator, type Lang } from "./index";

/** Idioma activo: cookie elegida por el usuario → idioma de su perfil → español. */
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(c)) return c;
  const session = await getSession();
  return isLang(session?.user?.locale) ? session.user.locale : "es";
}

export async function getT() {
  return translator(await getLang());
}
