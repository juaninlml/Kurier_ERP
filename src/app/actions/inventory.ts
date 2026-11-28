"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { safe } from "@/lib/safe-action";
import { getCurrentUser } from "@/lib/current-user";
import { DATE_RE, companyToday } from "@/lib/orders";
import { auditNote } from "@/lib/audit";
import { formatNumber, round2 } from "@/lib/money";
import { numv, str } from "./helpers";
import { UserError } from "@/lib/user-error";

const who = async () => {
  const me = await getCurrentUser();
  return me.name || me.email;
};

const refresh = () => {
  revalidatePath("/ordenes/inventario");
  revalidatePath("/ordenes/insumos");
  revalidatePath("/");
};

/** Material con inventario (existe y no es "Sin insumo"). */
async function material(fd: FormData) {
  const id = numv(fd, "materialId");
  const m = id ? await prisma.packMaterial.findUnique({ where: { id } }) : null;
  if (!m) throw new UserError("Elige el material.");
  if (m.noSupply) throw new UserError("“{v0}” no lleva inventario.", { v0: m.name });
  return m;
}

/** Fecha del movimiento: válida y no futura. */
async function moveDate(fd: FormData) {
  const date = str(fd, "date");
  if (!DATE_RE.test(date)) throw new UserError("La fecha no es válida.");
  if (date > (await companyToday())) throw new UserError("La fecha no puede ser futura.");
  return date;
}

const pieces = (fd: FormData, min: number) => {
  const q = numv(fd, "quantity");
  if (!Number.isInteger(q) || q < min || q > 10_000_000) throw new UserError(min > 0 ? "Captura las piezas recibidas (número entero mayor a 0)." : "Captura las piezas contadas (número entero, 0 o más).");
  return q;
};

/** Entrada de material (compra o surtido del proveedor). Opcionalmente actualiza el costo por pieza del material. */
async function addStockEntryImpl(fd: FormData) {
  const m = await material(fd);
  const date = await moveDate(fd);
  const quantity = pieces(fd, 1);
  const unitCost = round2(Math.max(0, numv(fd, "unitCost")));
  const supplier = str(fd, "supplier").slice(0, 120);
  const note = str(fd, "note").slice(0, 500);
  const created = await prisma.stockMove.create({ data: { materialId: m.id, kind: "ENTRADA", date, quantity, unitCost, supplier, note, createdBy: await who() } });
  if (unitCost > 0 && fd.get("updateCost")) await prisma.packMaterial.update({ where: { id: m.id }, data: { unitCost } });
  auditNote(`Inventario · entrada de ${formatNumber(quantity)} ${m.name}${supplier ? ` (${supplier})` : ""}`, "/ordenes/inventario", created.id);
  refresh();
}

/** Conteo físico: fija la existencia real del material al cierre de ese día. */
async function addStockCountImpl(fd: FormData) {
  const m = await material(fd);
  const date = await moveDate(fd);
  const quantity = pieces(fd, 0);
  const note = str(fd, "note").slice(0, 500);
  const created = await prisma.stockMove.create({ data: { materialId: m.id, kind: "CONTEO", date, quantity, note, createdBy: await who() } });
  auditNote(`Inventario · conteo físico de ${m.name}: ${formatNumber(quantity)} pzas.`, "/ordenes/inventario", created.id);
  refresh();
}

/** Existencia mínima para la alerta de "por agotarse" (0 = sin alerta). */
async function setMinStockImpl(materialId: number, fd: FormData) {
  const min = numv(fd, "minStock");
  if (!Number.isInteger(min) || min < 0 || min > 10_000_000) throw new UserError("El mínimo debe ser un número entero, 0 o más.");
  const m = await prisma.packMaterial.update({ where: { id: materialId }, data: { minStock: min } });
  auditNote(`Inventario · mínimo de ${m.name}: ${formatNumber(min)} pzas.`, "/ordenes/inventario", m.id);
  refresh();
}

/** Borra un movimiento capturado por error. */
async function deleteStockMoveImpl(id: number) {
  const x = await prisma.stockMove.findUnique({ where: { id }, include: { material: { select: { name: true } } } });
  if (!x) return;
  await prisma.stockMove.delete({ where: { id } });
  auditNote(`Inventario · se borró ${x.kind === "CONTEO" ? "un conteo" : "una entrada"} de ${x.material.name} (${x.date})`, "/ordenes/inventario", id);
  refresh();
}

export const addStockEntry = safe(addStockEntryImpl, "ordenes", "addStockEntryImpl");
export const addStockCount = safe(addStockCountImpl, "ordenes", "addStockCountImpl");
export const setMinStock = safe(setMinStockImpl, "ordenes", "setMinStockImpl");
export const deleteStockMove = safe(deleteStockMoveImpl, "ordenes", "deleteStockMoveImpl");
