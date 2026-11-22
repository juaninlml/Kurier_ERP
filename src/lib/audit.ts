import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "./db";
import type { ModuleId } from "./permissions";

/**
 * Bitácora de cambios. `safe()` anota cada acción que termina sin error (quién, cuándo, qué módulo,
 * qué hizo y sobre qué registro). Dentro de una acción se puede dar un resumen legible y la liga al
 * registro con `auditNote()`; si la acción redirige al registro nuevo, la liga se toma de ahí.
 */
type Note = { summary?: string; href?: string; entityId?: number };
const store = new AsyncLocalStorage<Note>();

/** Corre la acción con un "cuaderno" donde ella puede anotar su resumen. */
export function withAuditNote<T>(fn: () => Promise<T>) {
  const note: Note = {};
  return { note, run: store.run(note, fn) };
}

/** Resumen legible para la bitácora (p. ej. "Pago de $1,200.00 a FAC-00012"). */
export function auditNote(summary: string, href?: string, entityId?: number) {
  const n = store.getStore();
  if (!n) return;
  n.summary = summary;
  if (href) n.href = href;
  if (entityId) n.entityId = entityId;
}

/** Verbo de la acción a partir del nombre de la función (createInvoiceImpl → "Creó"). */
const VERBS: [RegExp, string][] = [
  [/^add\w*Payment/i, "Registró pago"],
  [/^(create|add|register|new|invite|import)/i, "Creó"],
  [/^(update|save|set|edit|rename|move|toggle|assign|apply|sync|upload|load|copy|generate|recalc|mark|confirm|approve)/i, "Modificó"],
  [/^(delete|remove|revoke|discard|clear)/i, "Eliminó"],
  [/^cancel/i, "Canceló"],
  [/^(reactivate|restore)/i, "Reactivó"],
  [/^(pay|settle)/i, "Pagó"],
];
export function verbOf(fnName: string) {
  const name = fnName.replace(/Impl$/, "");
  return VERBS.find(([re]) => re.test(name))?.[1] ?? "Modificó";
}

/** Ruta de una redirección de Next.js (para ligar el registro recién creado). */
export function redirectHref(e: unknown) {
  const digest = (e as { digest?: unknown })?.digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) return null;
  const url = digest.split(";")[2] ?? "";
  return url.startsWith("/") ? url.split("#")[0] : null;
}

export async function writeAudit(entry: {
  user: { id: number; name: string; email: string } | null;
  module: ModuleId;
  fnName: string;
  args: unknown[];
  note: Note;
  href?: string | null;
}) {
  const firstId = entry.args.find((a): a is number => typeof a === "number" && Number.isInteger(a));
  const hrefId = entry.href?.match(/\/(\d+)(?:[/?]|$)/)?.[1];
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.user?.id ?? null,
        userName: entry.user ? entry.user.name || entry.user.email : "",
        module: entry.module,
        action: verbOf(entry.fnName),
        fnName: entry.fnName.replace(/Impl$/, "").slice(0, 80),
        entityId: entry.note.entityId ?? (hrefId ? Number(hrefId) : firstId) ?? null,
        summary: (entry.note.summary ?? "").slice(0, 300),
        href: (entry.note.href ?? entry.href ?? "").slice(0, 200),
      },
    });
  } catch (e) {
    // La bitácora nunca debe tumbar la acción que ya se hizo.
    console.error("No se pudo escribir la bitácora", e);
  }
}
