"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { safe } from "@/lib/safe-action";
import { DATE_RE } from "@/lib/orders";
import { numv, str } from "./helpers";

const cellsSchema = z
  .array(
    z.object({
      clientId: z.number().int().positive(),
      colId: z.number().int().positive(),
      quantity: z.number().int("Captura números enteros.").min(0, "Las piezas no pueden ser negativas.").max(1_000_000),
    }),
  )
  .max(2000);

const refresh = () => {
  revalidatePath("/ordenes");
  revalidatePath("/ordenes/insumos");
};

/** Guarda celdas de la hoja de insumos (autoguardado). Una cantidad 0 borra la celda. */
export async function saveSupplyCells(date: string, cells: { clientId: number; colId: number; quantity: number }[]): Promise<{ ok: true } | { error: string }> {
  if (!DATE_RE.test(date)) return { error: "Fecha inválida." };
  const parsed = cellsSchema.safeParse(cells);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  try {
    await prisma.$transaction(
      parsed.data.map((c) =>
        c.quantity === 0
          ? prisma.dailySupply.deleteMany({ where: { workDate: date, clientId: c.clientId, materialId: c.colId } })
          : prisma.dailySupply.upsert({
              where: { workDate_clientId_materialId: { workDate: date, clientId: c.clientId, materialId: c.colId } },
              create: { workDate: date, clientId: c.clientId, materialId: c.colId, quantity: c.quantity },
              update: { quantity: c.quantity },
            }),
      ),
    );
  } catch (e) {
    console.error(e);
    return { error: "No se pudo guardar. Revisa tu conexión e intenta de nuevo." };
  }
  refresh();
  return { ok: true };
}

async function addMaterialImpl(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Escribe el nombre del material.");
  const size = str(fd, "size");
  const existing = await prisma.packMaterial.findUnique({ where: { name } });
  if (existing) {
    if (existing.active) throw new Error("Ya existe un material con ese nombre.");
    await prisma.packMaterial.update({ where: { id: existing.id }, data: { active: true, size: size || existing.size } });
  } else {
    const last = await prisma.packMaterial.aggregate({ _max: { sortOrder: true } });
    await prisma.packMaterial.create({ data: { name, size, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  refresh();
}

async function updateMaterialImpl(id: number, fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre no puede quedar vacío.");
  await prisma.packMaterial.update({ where: { id }, data: { name, size: str(fd, "size") } });
  refresh();
}

/** Oculta el material de la captura. Lo ya registrado se conserva en totales y reportes. */
async function toggleMaterialImpl(id: number) {
  const m = await prisma.packMaterial.findUniqueOrThrow({ where: { id } });
  await prisma.packMaterial.update({ where: { id }, data: { active: !m.active } });
  refresh();
}

async function moveMaterialImpl(id: number, fd: FormData) {
  const dir = numv(fd, "dir");
  const list = await prisma.packMaterial.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const i = list.findIndex((m) => m.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j]!, list[i]!];
  await prisma.$transaction(list.map((m, k) => prisma.packMaterial.update({ where: { id: m.id }, data: { sortOrder: k + 1 } })));
  refresh();
}

export const addMaterial = safe(addMaterialImpl);
export const updateMaterial = safe(updateMaterialImpl);
export const toggleMaterial = safe(toggleMaterialImpl);
export const moveMaterial = safe(moveMaterialImpl);
