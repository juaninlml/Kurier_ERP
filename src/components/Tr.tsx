"use client";

import { useT } from "./I18nProvider";

/**
 * Texto traducible dentro de JSX: `<Tr>Guardar cambios</Tr>`.
 * Sirve igual en componentes de servidor y de cliente (toma el idioma de I18nProvider).
 * La clave es el texto en español; el inglés está en src/lib/i18n/en.ts.
 */
export function Tr({ children }: { children: string }) {
  return useT()(children);
}
