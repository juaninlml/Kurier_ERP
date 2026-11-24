"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { auditNote } from "@/lib/audit";
import { finishRouteLoad, newStorageCode } from "@/lib/route-load";
import { str } from "./helpers";

function revalidate() {
  revalidatePath("/envios/almacenamientos");
  revalidatePath("/reparto");
  revalidatePath("/envios");
}

async function createStorageImpl(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Escribe el nombre del almacenamiento (p. ej. Jaula 1 · NP300).");
  if (name.length > 60) throw new Error("El nombre no puede pasar de 60 caracteres.");
  const unit = await prisma.storageUnit.create({ data: { name, code: await newStorageCode() } });
  auditNote(`Almacenamiento ${unit.name} (${unit.code})`, "/envios/almacenamientos", unit.id);
  revalidate();
}

async function renameStorageImpl(id: number, fd: FormData) {
  const name = str(fd, "name");
  if (!name || name.length > 60) throw new Error("Escribe un nombre de hasta 60 caracteres.");
  const unit = await prisma.storageUnit.update({ where: { id }, data: { name } });
  auditNote(`Almacenamiento ${unit.code} ahora se llama ${name}`, "/envios/almacenamientos", id);
  revalidate();
}

async function toggleStorageImpl(id: number) {
  const unit = await prisma.storageUnit.findUniqueOrThrow({ where: { id } });
  if (unit.active) {
    const busy = await prisma.routeLoad.count({ where: { storageId: id, status: { in: ["CARGANDO", "EN_REPARTO"] } } });
    if (busy) throw new Error("Ese almacenamiento está en una ruta en curso. Termínala primero.");
  }
  await prisma.storageUnit.update({ where: { id }, data: { active: !unit.active } });
  auditNote(`${unit.active ? "Desactivó" : "Activó"} ${unit.name} (${unit.code})`, "/envios/almacenamientos", id);
  revalidate();
}

/** Un administrador termina una ruta que el repartidor dejó abierta (p. ej. se le acabó la batería). */
async function adminFinishLoadImpl(loadId: number) {
  const me = await getCurrentUser();
  const { returned, load } = await finishRouteLoad(loadId, me.name || me.email);
  auditNote(`Terminó la ruta de ${load.driverName} (${load.storage.name})${returned ? ` · ${returned} paquete(s) regresaron al almacén` : ""}`, "/envios/almacenamientos", loadId);
  revalidate();
}

export const createStorage = safe(createStorageImpl, "envios", "createStorageImpl");
export const renameStorage = safe(renameStorageImpl, "envios", "renameStorageImpl");
export const toggleStorage = safe(toggleStorageImpl, "envios", "toggleStorageImpl");
export const adminFinishLoad = safe(adminFinishLoadImpl, "envios", "adminFinishLoadImpl");
