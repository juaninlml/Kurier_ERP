"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseWmsPdf } from "@/lib/wms/pdf";
import { saveStatement } from "@/lib/wms/imports";
import { numv } from "./helpers";

const MAX_PDF = 4 * 1024 * 1024;

async function importWmsPdfImpl(fd: FormData) {
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new Error("Selecciona al menos un PDF del WMS.");
  const ids: number[] = [];
  const errors: string[] = [];
  for (const f of files) {
    if (f.size > MAX_PDF) {
      errors.push(`${f.name}: el archivo pesa más de 4 MB.`);
      continue;
    }
    try {
      const st = await parseWmsPdf(new Uint8Array(await f.arrayBuffer()));
      ids.push((await saveStatement(st, "pdf")).id);
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : "no se pudo leer."}`);
    }
  }
  revalidatePath("/facturas/importar");
  if (errors.length) throw new Error(`${ids.length ? `Se importaron ${ids.length} archivo(s). ` : ""}${errors.join(" ")}`);
  redirect(ids.length === 1 ? `/facturas/importar/${ids[0]}` : "/facturas/importar");
}

/** Asigna el cliente del ERP a la importación y, opcionalmente, recuerda el nombre del WMS en el cliente. */
async function assignImportClientImpl(id: number, fd: FormData) {
  const clientId = numv(fd, "clientId");
  if (!clientId) throw new Error("Selecciona un cliente.");
  const imp = await prisma.wmsImport.update({ where: { id }, data: { clientId } });
  if (fd.get("remember") === "on" && imp.clientName) await prisma.client.update({ where: { id: clientId }, data: { wmsName: imp.clientName } });
  revalidatePath(`/facturas/importar/${id}`);
  revalidatePath("/facturas/importar");
}

async function setImportStatusImpl(id: number, status: "PENDIENTE" | "DESCARTADO") {
  const imp = await prisma.wmsImport.findUniqueOrThrow({ where: { id } });
  if (imp.status === "FACTURADO") throw new Error("Esta importación ya se facturó.");
  await prisma.wmsImport.update({ where: { id }, data: { status } });
  revalidatePath("/facturas/importar");
  revalidatePath(`/facturas/importar/${id}`);
}

async function deleteImportImpl(id: number) {
  const imp = await prisma.wmsImport.findUniqueOrThrow({ where: { id } });
  if (imp.status === "FACTURADO") throw new Error("No se puede eliminar: ya se facturó.");
  await prisma.wmsImport.delete({ where: { id } });
  revalidatePath("/facturas/importar");
  redirect("/facturas/importar");
}

export const importWmsPdf = safe(importWmsPdfImpl, "facturas", "importWmsPdfImpl");
export const assignImportClient = safe(assignImportClientImpl, "facturas", "assignImportClientImpl");
export const discardImport = safe(async (id: number) => setImportStatusImpl(id, "DESCARTADO"), "facturas", "discardImport");
export const restoreImport = safe(async (id: number) => setImportStatusImpl(id, "PENDIENTE"), "facturas", "restoreImport");
export const deleteImport = safe(deleteImportImpl, "facturas", "deleteImportImpl");
