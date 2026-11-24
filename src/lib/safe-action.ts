import { unstable_rethrow } from "next/navigation";
import { getSessionUser } from "./current-user";
import { canWrite, READ_ONLY_MESSAGE, type ModuleId } from "./permissions";
import { redirectHref, withAuditNote, writeAudit } from "./audit";
import { getT } from "./i18n/server";
import { translateError } from "./user-error";

export type ActionResult = { error: string } | void;

/** Traduce un error a un mensaje para el usuario (en producción Next.js oculta el mensaje original). */
function toMessage(e: unknown): string {
  const err = e as { name?: string; code?: string; message?: string };
  if (err?.name?.startsWith("PrismaClient")) {
    console.error(e);
    if (err.code === "P2002") return "Ya existe un registro con ese valor (clave o folio duplicado).";
    if (err.code === "P2025") return "El registro ya no existe. Recarga la página.";
    if (err.code === "P2003") return "No se puede eliminar: hay documentos que dependen de este registro.";
    return "Error al guardar en la base de datos. Intenta de nuevo.";
  }
  return err?.message || "Ocurrió un error inesperado.";
}

const SESSION_EXPIRED = "Tu sesión terminó. Vuelve a iniciar sesión.";

/**
 * Lanza si no hay sesión activa o si el rol no puede modificar el módulo.
 * Úsalo en las acciones que no pasan por `safe` (autoguardado de tablas).
 */
export async function assertSignedIn(module: ModuleId = "general") {
  const user = await getSessionUser();
  if (!user) throw new Error(SESSION_EXPIRED);
  if (!canWrite(user.role, module)) throw new Error(READ_ONLY_MESSAGE);
  return user;
}

function wrap<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, module: ModuleId | null, name?: string) {
  // El nombre se pasa explícito: en producción el código del servidor se minifica y fn.name no sirve.
  const fnName = name || fn.name || "accion";
  return async (...args: A): Promise<ActionResult> => {
    // Las server actions se pueden invocar desde cualquier ruta (incluso /login, que es pública),
    // así que la sesión y el permiso se validan aquí y no solo en el proxy.
    const user = module ? await getSessionUser() : null;
    if (module) {
      if (!user) return { error: SESSION_EXPIRED };
      if (!canWrite(user.role, module)) return { error: READ_ONLY_MESSAGE };
    }
    const { note, run } = withAuditNote(() => fn(...args));
    try {
      await run;
    } catch (e) {
      // Una redirección al terminar también es éxito: se anota con la liga a donde llevó.
      const href = redirectHref(e);
      if (href && module) await writeAudit({ user, module, fnName, args, note, href });
      unstable_rethrow(e);
      // En el idioma del usuario (los mensajes con datos variables vienen como UserError)
      const t = await getT().catch(() => null);
      if (t && !(e as { name?: string })?.name?.startsWith("PrismaClient")) return { error: translateError(e, t) ?? t(toMessage(e)) };
      return { error: t ? t(toMessage(e)) : toMessage(e) };
    }
    if (module) await writeAudit({ user, module, fnName, args, note });
  };
}

/**
 * Envuelve una server action: exige sesión activa y permiso de escritura en el módulo; si falla,
 * regresa `{ error }` en lugar de lanzar, para que el formulario muestre el mensaje. Las redirecciones
 * de Next.js se respetan. Cada acción que termina bien queda en la bitácora (ver src/lib/audit.ts).
 */
export function safe<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, module: ModuleId = "general", name?: string) {
  return wrap(fn, module, name);
}

/** Igual que `safe`, pero sin exigir sesión ni anotar en bitácora: solo login, invitaciones, idioma y tablets. */
export function safePublic<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return wrap(fn, null);
}
