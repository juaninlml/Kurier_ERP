import type { T } from "./i18n";

type Vars = Record<string, string | number>;

const fill = (text: string, vars: Vars) => Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), text);

/**
 * Error para mostrarse al usuario con datos variables, traducible: la plantilla en español es la clave
 * del diccionario y los datos van aparte. `throw new UserError("La guía {v0} ya fue entregada.", { v0: tracking })`.
 * El mensaje en español sigue disponible en `message` (bitácora, logs).
 */
export class UserError extends Error {
  readonly key: string;
  readonly vars: Vars;
  constructor(key: string, vars: Vars = {}) {
    super(fill(key, vars));
    this.name = "UserError";
    this.key = key;
    this.vars = vars;
  }
}

/** Mensaje del error en el idioma del usuario. Los datos de texto también se traducen si están en el diccionario. */
export function translateError(e: unknown, t: T): string | null {
  if (e instanceof UserError) {
    const vars = Object.fromEntries(Object.entries(e.vars).map(([k, v]) => [k, typeof v === "string" ? t(v) : v]));
    return t(e.key, vars);
  }
  const msg = (e as { message?: unknown })?.message;
  return typeof msg === "string" && msg ? t(msg) : null;
}
