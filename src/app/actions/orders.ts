"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSignedIn, safe } from "@/lib/safe-action";
import { DATE_RE } from "@/lib/orders";
import { numv, str } from "./helpers";

const cellsSchema = z
  .array(
    z.object({
      clientId: z.number().int().positive(),
      waveId: z.number().int().positive(),
      quantity: z.number().int("Captura números enteros.").min(0, "Las órdenes no pueden ser negativas.").max(1_000_000),
    }),
  )
  .max(2000);

/**
 * Guarda celdas de la tabla de órdenes diarias (autoguardado). Una cantidad 0 borra la celda.
 * Regresa { ok } o { error } para que la tabla muestre el estado sin recargar.
 */
export async function saveOrderCells(date: string, cells: { clientId: number; waveId: number; quantity: number }[]): Promise<{ ok: true } | { error: string }> {
  try {
    await assertSignedIn("ordenes");
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!DATE_RE.test(date)) return { error: "Fecha inválida." };
  const parsed = cellsSchema.safeParse(cells);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  try {
    await prisma.$transaction(
      parsed.data.map((c) => {
        const where = { workDate_clientId_waveId: { workDate: date, clientId: c.clientId, waveId: c.waveId } };
        return c.quantity === 0
          ? prisma.dailyOrder.deleteMany({ where: { workDate: date, clientId: c.clientId, waveId: c.waveId } })
          : prisma.dailyOrder.upsert({ where, create: { workDate: date, clientId: c.clientId, waveId: c.waveId, quantity: c.quantity }, update: { quantity: c.quantity } });
      }),
    );
  } catch (e) {
    console.error(e);
    return { error: "No se pudo guardar. Revisa tu conexión e intenta de nuevo." };
  }
  revalidatePath("/ordenes");
  return { ok: true };
}

/** Tarifa por paquete del servicio logístico de un cliente (0 = usar su tarifa negociada). */
export async function saveOrderRate(clientId: number, rate: number): Promise<{ ok: true } | { error: string }> {
  try {
    await assertSignedIn("ordenes");
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!Number.isInteger(clientId) || clientId <= 0) return { error: "Cliente inválido." };
  if (!Number.isFinite(rate) || rate < 0) return { error: "La tarifa debe ser un número mayor o igual a 0." };
  try {
    await prisma.client.update({ where: { id: clientId }, data: { orderRate: Math.round(rate * 100) / 100 } });
  } catch (e) {
    console.error(e);
    return { error: "No se pudo guardar la tarifa. Recarga la página e intenta de nuevo." };
  }
  revalidatePath("/ordenes");
  return { ok: true };
}

async function addWaveImpl(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Escribe el nombre de la oleada.");
  const last = await prisma.orderWave.aggregate({ _max: { sortOrder: true } });
  const existing = await prisma.orderWave.findUnique({ where: { name } });
  if (existing) {
    if (existing.active) throw new Error("Ya existe una oleada con ese nombre.");
    await prisma.orderWave.update({ where: { id: existing.id }, data: { active: true } });
  } else {
    await prisma.orderWave.create({ data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  }
  revalidatePath("/ordenes");
}

async function renameWaveImpl(id: number, fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("El nombre no puede quedar vacío.");
  await prisma.orderWave.update({ where: { id }, data: { name } });
  revalidatePath("/ordenes");
}

/** Oculta la oleada de la tabla. Las órdenes ya capturadas se conservan en los totales y reportes. */
async function toggleWaveImpl(id: number) {
  const w = await prisma.orderWave.findUniqueOrThrow({ where: { id } });
  await prisma.orderWave.update({ where: { id }, data: { active: !w.active } });
  revalidatePath("/ordenes");
}

async function moveWaveImpl(id: number, fd: FormData) {
  const dir = numv(fd, "dir");
  const waves = await prisma.orderWave.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const i = waves.findIndex((w) => w.id === id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= waves.length) return;
  [waves[i], waves[j]] = [waves[j]!, waves[i]!];
  await prisma.$transaction(waves.map((w, k) => prisma.orderWave.update({ where: { id: w.id }, data: { sortOrder: k + 1 } })));
  revalidatePath("/ordenes");
}

export const addWave = safe(addWaveImpl, "ordenes", "addWaveImpl");
export const renameWave = safe(renameWaveImpl, "ordenes", "renameWaveImpl");
export const toggleWave = safe(toggleWaveImpl, "ordenes", "toggleWaveImpl");
export const moveWave = safe(moveWaveImpl, "ordenes", "moveWaveImpl");
