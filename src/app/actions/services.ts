"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { numv, str } from "./helpers";

function serviceData(fd: FormData) {
  const code = str(fd, "code").toUpperCase();
  const name = str(fd, "name");
  if (!code || !name) throw new Error("Clave y nombre son obligatorios.");
  return {
    code,
    name,
    description: str(fd, "description"),
    section: str(fd, "section"),
    priceText: str(fd, "priceText"),
    atCost: fd.get("atCost") === "on",
    unit: str(fd, "unit") || "Servicio",
    unitPrice: numv(fd, "unitPrice"),
    taxRate: numv(fd, "taxRate", 16),
  };
}

/** Crea la sección si no existe, al final del tarifario. */
async function ensureSection(name: string) {
  if (!name) return;
  const exists = await prisma.serviceSection.findUnique({ where: { name } });
  if (exists) return;
  const last = await prisma.serviceSection.aggregate({ _max: { sortOrder: true } });
  await prisma.serviceSection.create({ data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
}

export async function createService(fd: FormData) {
  const data = serviceData(fd);
  if (await prisma.service.findUnique({ where: { code: data.code } })) throw new Error(`Ya existe un servicio con la clave ${data.code}.`);
  await ensureSection(data.section);
  const last = await prisma.service.aggregate({ _max: { sortOrder: true } });
  await prisma.service.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  revalidatePath("/servicios");
  redirect("/servicios");
}

export async function updateService(id: number, fd: FormData) {
  const data = serviceData(fd);
  await ensureSection(data.section);
  await prisma.service.update({ where: { id }, data: { ...data, active: fd.get("active") === "on" } });
  revalidatePath("/servicios");
  redirect("/servicios");
}

export async function updateSectionNote(id: number, fd: FormData) {
  await prisma.serviceSection.update({ where: { id }, data: { note: str(fd, "note") } });
  revalidatePath("/servicios");
}
