"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { safe } from "@/lib/safe-action";
import { getCurrentUser } from "@/lib/current-user";
import { DATE_RE } from "@/lib/orders";
import { CONTACT_LABEL, isContactKind } from "@/lib/collection-kinds";
import { auditNote } from "@/lib/audit";
import { round2 } from "@/lib/money";
import { numv, str } from "./helpers";
import { UserError } from "@/lib/user-error";

const who = async () => {
  const me = await getCurrentUser();
  return me.name || me.email;
};

async function clientName(clientId: number) {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!c) throw new UserError("El cliente ya no existe. Recarga la página.");
  return c.name;
}

/** Registra un seguimiento de cobranza (llamada, visita, nota…) con promesa de pago opcional. */
async function addCollectionNoteImpl(clientId: number, fd: FormData) {
  const kind = str(fd, "kind");
  if (!isContactKind(kind)) throw new UserError("Elige el tipo de seguimiento.");
  const note = str(fd, "note").slice(0, 1000);
  const promiseDate = str(fd, "promiseDate");
  if (promiseDate && !DATE_RE.test(promiseDate)) throw new UserError("La fecha de la promesa de pago no es válida.");
  const promiseAmount = promiseDate ? round2(Math.max(0, numv(fd, "promiseAmount"))) : 0;
  if (!note && !promiseDate) throw new UserError("Escribe qué pasó o la fecha en que prometió pagar.");
  const name = await clientName(clientId);
  const created = await prisma.collectionNote.create({ data: { clientId, kind, note, promiseDate, promiseAmount, createdBy: await who() } });
  auditNote(`Cobranza · ${name}: ${CONTACT_LABEL[kind]}${promiseDate ? ` · promesa de pago ${promiseDate}` : ""}`, "/cobranza", created.id);
  revalidatePath("/cobranza");
}

/** Anota en el historial que se abrió el recordatorio por WhatsApp o correo (se llama al pulsar el botón). */
async function logReminderImpl(clientId: number, channel: string) {
  const kind = channel === "CORREO" ? "CORREO" : "WHATSAPP";
  const name = await clientName(clientId);
  await prisma.collectionNote.create({ data: { clientId, kind, note: "Recordatorio de pago enviado", createdBy: await who() } });
  auditNote(`Cobranza · ${name}: recordatorio por ${CONTACT_LABEL[kind]}`, "/cobranza");
  revalidatePath("/cobranza");
}

/** Borra un seguimiento capturado por error. */
async function deleteCollectionNoteImpl(id: number) {
  const n = await prisma.collectionNote.findUnique({ where: { id }, include: { client: { select: { name: true } } } });
  if (!n) return;
  await prisma.collectionNote.delete({ where: { id } });
  auditNote(`Cobranza · ${n.client.name}: se borró un seguimiento (${CONTACT_LABEL[isContactKind(n.kind) ? n.kind : "NOTA"]})`, "/cobranza", id);
  revalidatePath("/cobranza");
}

export const addCollectionNote = safe(addCollectionNoteImpl, "cobranza", "addCollectionNoteImpl");
export const logReminder = safe(logReminderImpl, "cobranza", "logReminderImpl");
export const deleteCollectionNote = safe(deleteCollectionNoteImpl, "cobranza", "deleteCollectionNoteImpl");
