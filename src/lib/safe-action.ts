import { unstable_rethrow } from "next/navigation";
import { getSessionUser } from "./current-user";

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

/** Lanza si no hay una sesión activa. Úsalo en las acciones que no pasan por `safe` (autoguardado de tablas). */
export async function assertSignedIn() {
  if (!(await getSessionUser())) throw new Error(SESSION_EXPIRED);
}

function wrap<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, requireSession: boolean) {
  return async (...args: A): Promise<ActionResult> => {
    try {
      // Las server actions se pueden invocar desde cualquier ruta (incluso /login, que es pública),
      // así que la sesión se valida aquí y no solo en el proxy.
      if (requireSession && !(await getSessionUser())) return { error: SESSION_EXPIRED };
      await fn(...args);
    } catch (e) {
      unstable_rethrow(e);
      return { error: toMessage(e) };
    }
  };
}

/**
 * Envuelve una server action: exige sesión activa y, si falla, regresa `{ error }` en lugar de lanzar,
 * para que el formulario muestre el mensaje. Las redirecciones de Next.js se respetan.
 */
export function safe<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return wrap(fn, true);
}

/** Igual que `safe`, pero sin exigir sesión: solo para login, invitaciones, idioma y autorización de tablets. */
export function safePublic<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return wrap(fn, false);
}
