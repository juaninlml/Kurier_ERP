"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { safe } from "@/lib/safe-action";
import { getCurrentUser } from "@/lib/current-user";
import { DATE_RE } from "@/lib/orders";
import { exitFolio, folioNumber, TIME_RE } from "@/lib/goods-exit";
import { auditNote } from "@/lib/audit";
import { str } from "./helpers";
import { UserError } from "@/lib/user-error";

const who = async () => {
  const me = await getCurrentUser();
  return me.name || me.email;
};

const lineSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  boxes: z.number().int().min(1).max(100000),
  piecesPerBox: z.number().int().min(1).max(100000),
});

/** Datos del formulario de salida (los renglones viajan como JSON en el campo "items"). */
async function exitData(fd: FormData) {
  const clientId = Number(str(fd, "clientId"));
  if (!clientId) throw new Error("Elige el cliente de la mercancía.");
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new Error("El cliente ya no existe. Recarga la página.");
  const date = str(fd, "date");
  if (!DATE_RE.test(date)) throw new Error("La fecha de salida no es válida.");
  const time = str(fd, "time");
  if (time && !TIME_RE.test(time)) throw new Error("La hora de salida no es válida.");

  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "items") || "[]");
  } catch {
    throw new Error("No se pudieron leer los renglones. Recarga la página.");
  }
  // Se ignoran los renglones vacíos (sin SKU ni cantidades)
  const rows = (Array.isArray(raw) ? raw : []).filter(
    (r: { sku?: string; boxes?: number; piecesPerBox?: number }) => String(r?.sku ?? "").trim() || Number(r?.boxes) || Number(r?.piecesPerBox),
  );
  if (!rows.length) throw new Error("Agrega al menos un SKU con sus cajas y piezas por caja.");
  const items = rows.map((r, i) => {
    const p = lineSchema.safeParse(r);
    if (!p.success) throw new UserError("Renglón {v0}: escribe el SKU, las cajas entregadas y las piezas por caja (números enteros mayores a 0).", { v0: i + 1 });
    return { ...p.data, sku: p.data.sku.toUpperCase(), position: i };
  });

  return {
    data: {
      clientId,
      date,
      time,
      reference: str(fd, "reference").slice(0, 120),
      carrier: str(fd, "carrier").slice(0, 120),
      plates: str(fd, "plates").toUpperCase().slice(0, 40),
      driverName: str(fd, "driverName").slice(0, 120),
      deliveredBy: str(fd, "deliveredBy").slice(0, 120),
      notes: str(fd, "notes").slice(0, 1000),
    },
    items,
  };
}

async function nextFolio() {
  const last = await prisma.goodsExit.findFirst({ orderBy: { id: "desc" }, select: { folio: true } });
  return exitFolio((last ? folioNumber(last.folio) : 0) + 1);
}

async function createExitImpl(fd: FormData) {
  const { data, items } = await exitData(fd);
  const createdBy = await who();
  let id = 0;
  // Si dos personas guardan al mismo tiempo, el folio choca (único) y se toma el siguiente
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    try {
      const folio = await nextFolio();
      const e = await prisma.goodsExit.create({ data: { ...data, folio, createdBy, items: { create: items } } });
      id = e.id;
      auditNote(`Salida ${folio}: ${items.length} SKU, ${items.reduce((a, l) => a + l.boxes, 0)} cajas`, `/salidas/${e.id}`, e.id);
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt === 2) throw e;
    }
  }
  revalidatePath("/salidas");
  redirect(`/salidas/${id}?nueva=1`);
}

async function updateExitImpl(id: number, fd: FormData) {
  const { data, items } = await exitData(fd);
  const e = await prisma.goodsExit.update({
    where: { id },
    data: { ...data, items: { deleteMany: {}, create: items } },
    select: { folio: true },
  });
  auditNote(`Salida ${e.folio} actualizada`, `/salidas/${id}`, id);
  revalidatePath("/salidas");
  revalidatePath(`/salidas/${id}`);
}

async function deleteExitImpl(id: number) {
  const e = await prisma.goodsExit.delete({ where: { id }, select: { folio: true } });
  auditNote(`Salida ${e.folio} eliminada`, undefined, id);
  revalidatePath("/salidas");
  redirect("/salidas");
}

export const createExit = safe(createExitImpl, "salidas", "createExitImpl");
export const updateExit = safe(updateExitImpl, "salidas", "updateExitImpl");
export const deleteExit = safe(deleteExitImpl, "salidas", "deleteExitImpl");
