"use server";

import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { numv, str } from "./helpers";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function supplierData(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre del proveedor es obligatorio.");
  const email = str(fd, "email");
  if (email && !EMAIL_RE.test(email)) throw new Error("El correo del proveedor no es válido.");
  const clabe = str(fd, "clabe").replace(/\s/g, "");
  if (clabe && !/^\d{18}$/.test(clabe)) throw new Error("La CLABE debe tener 18 dígitos.");
  const creditDays = Math.round(numv(fd, "creditDays"));
  if (creditDays < 0 || creditDays > 365) throw new Error("Los días de crédito deben estar entre 0 y 365.");
  return {
    name,
    legalName: str(fd, "legalName"),
    rfc: str(fd, "rfc").toUpperCase(),
    category: str(fd, "category"),
    contactName: str(fd, "contactName"),
    email,
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    website: str(fd, "website"),
    creditDays,
    bank: str(fd, "bank"),
    clabe,
    accountNumber: str(fd, "accountNumber"),
    notes: str(fd, "notes"),
  };
}

async function createSupplierImpl(fd: FormData) {
  const s = await prisma.supplier.create({ data: supplierData(fd) });
  revalidatePath("/proveedores");
  redirect(`/proveedores/${s.id}?nuevo=1`);
}

async function updateSupplierImpl(id: number, fd: FormData) {
  await prisma.supplier.update({ where: { id }, data: { ...supplierData(fd), active: fd.get("active") === "on" } });
  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${id}`);
  revalidatePath("/contabilidad");
}

// Acciones públicas: los errores regresan como { error } para mostrarlos en el formulario.
export const createSupplier = safe(createSupplierImpl, "proveedores", "createSupplierImpl");
export const updateSupplier = safe(updateSupplierImpl, "proveedores", "updateSupplierImpl");
