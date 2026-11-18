import { unstable_rethrow } from "next/navigation";

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

/**
 * Envuelve una server action: si falla, regresa `{ error }` en lugar de lanzar,
 * para que el formulario muestre el mensaje. Las redirecciones de Next.js se respetan.
 */
export function safe<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A): Promise<ActionResult> => {
    try {
      await fn(...args);
    } catch (e) {
      unstable_rethrow(e);
      return { error: toMessage(e) };
    }
  };
}
