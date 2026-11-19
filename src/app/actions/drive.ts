"use server";

import { revalidatePath } from "next/cache";
import { safe } from "@/lib/safe-action";
import { requireAdmin } from "@/lib/current-user";
import { driveConfigured } from "@/lib/drive";
import { archiveNow, syncPending } from "@/lib/archive";

/** Sube a Drive un lote de documentos pendientes (sin copia, con error o modificados). */
async function syncDriveImpl() {
  await requireAdmin();
  if (!driveConfigured()) throw new Error("Google Drive no está configurado en las variables de entorno.");
  const r = await syncPending(15);
  revalidatePath("/configuracion");
  if (r.done === 0 && r.failed > 0) throw new Error(`No se pudo subir ningún documento (${r.failed} con error). Revisa el detalle abajo.`);
}

/** Vuelve a subir un documento (botón junto a "Ver en Drive"). */
async function resyncDocImpl(ref: string, path: string) {
  if (!/^(factura|cotizacion|nomina):\d+$|^ordenes:\d+:\d{4}-\d{2}-\d{2}$/.test(ref)) throw new Error("Documento inválido.");
  if (!(await archiveNow(ref))) throw new Error("No se pudo subir a Drive. Revisa Configuración → Google Drive.");
  revalidatePath(path);
}

export const syncDrive = safe(syncDriveImpl);
export const resyncDoc = safe(resyncDocImpl);
