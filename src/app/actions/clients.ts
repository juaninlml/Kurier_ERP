"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { str } from "./helpers";

function clientData(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre del cliente es obligatorio.");
  return {
    name,
    legalName: str(fd, "legalName"),
    rfc: str(fd, "rfc").toUpperCase(),
    contactName: str(fd, "contactName"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    notes: str(fd, "notes"),
  };
}

async function createClientImpl(fd: FormData) {
  const c = await prisma.client.create({ data: clientData(fd) });
  revalidatePath("/clientes");
  redirect(`/clientes/${c.id}`);
}

async function updateClientImpl(id: number, fd: FormData) {
  await prisma.client.update({ where: { id }, data: { ...clientData(fd), active: fd.get("active") === "on" } });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

// Acciones públicas: los errores regresan como { error } para mostrarlos en el formulario.
export const createClient = safe(createClientImpl);
export const updateClient = safe(updateClientImpl);
