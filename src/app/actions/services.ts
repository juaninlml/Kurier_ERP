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
    unit: str(fd, "unit") || "Servicio",
    unitPrice: numv(fd, "unitPrice"),
    taxRate: numv(fd, "taxRate", 16),
  };
}

export async function createService(fd: FormData) {
  await prisma.service.create({ data: serviceData(fd) });
  revalidatePath("/servicios");
  redirect("/servicios");
}

export async function updateService(id: number, fd: FormData) {
  await prisma.service.update({ where: { id }, data: { ...serviceData(fd), active: fd.get("active") === "on" } });
  revalidatePath("/servicios");
  redirect("/servicios");
}
