"use server";

import { revalidatePath } from "next/cache";
import { safe } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { workdaysIn } from "@/lib/incidents";
import { localParts } from "@/lib/attendance";
import { benefits } from "@/lib/payroll";
import { vacationTakenMap } from "@/lib/payroll-data";
import { str } from "./helpers";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const refresh = (employeeId: number) => {
  revalidatePath(`/nomina/empleados/${employeeId}`);
  revalidatePath("/nomina");
};
const who = async () => {
  const me = await getCurrentUser();
  return me.name || me.email;
};

/** Revisa que haya vacaciones disponibles para autorizar `days` días más. */
async function assertVacationBalance(employee: { id: number; startDate: Date; dailySalary: number; workDays: number }, days: number, at: string) {
  const taken = (await vacationTakenMap([employee], new Date(`${at}T12:00:00Z`))).get(employee.id) ?? 0;
  const b = benefits(employee, taken, new Date(`${at}T12:00:00Z`));
  if (days > b.vacationAvailable) {
    throw new Error(
      b.vacationEntitled === 0
        ? "Aún no cumple 1 año de antigüedad: no tiene vacaciones disponibles."
        : `Solo tiene ${b.vacationAvailable} día(s) de vacaciones disponibles en este periodo.`,
    );
  }
}

/** Registra una falta injustificada, un permiso (falta justificada) o vacaciones. */
async function createIncidentImpl(employeeId: number, fd: FormData) {
  const e = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const type = str(fd, "type");
  if (!["FALTA", "PERMISO", "VACACIONES"].includes(type)) throw new Error("Elige el tipo de incidencia.");
  const startDate = str(fd, "startDate");
  const endDate = str(fd, "endDate") || startDate;
  if (!DATE.test(startDate) || !DATE.test(endDate)) throw new Error("Indica las fechas.");
  if (endDate < startDate) throw new Error("La fecha final es anterior a la inicial.");
  const days = workdaysIn(startDate, endDate, e).length;
  if (!days) throw new Error("Esas fechas no tienen días laborables del empleado.");
  const reason = str(fd, "reason");
  if (type === "PERMISO" && !reason) throw new Error("Escribe el motivo del permiso.");
  // Un permiso o vacaciones puede cubrir días que ya estaban como falta: al autorizarse, la falta se justifica
  const overlap = await prisma.incident.findFirst({
    where: { employeeId, status: { not: "RECHAZADA" }, startDate: { lte: endDate }, endDate: { gte: startDate }, ...(type === "FALTA" ? {} : { type: { not: "FALTA" } }) },
  });
  if (overlap) throw new Error("Ya hay una incidencia registrada en esas fechas.");
  // Registro histórico (migración): fechas que ya pasaron y se pagaron fuera del ERP. Quedan en el historial,
  // descuentan del saldo de vacaciones (y las faltas, del aguinaldo), pero nunca entran a una nómina.
  const historical = fd.get("historical") === "on";
  if (historical) {
    const cfg = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true } });
    const today = localParts(new Date(), cfg?.timezone || "America/Mexico_City").date;
    if (endDate >= today) throw new Error("El registro histórico es solo para fechas que ya pasaron (hasta ayer).");
  }
  // Las faltas quedan registradas; vacaciones y permisos se autorizan ahora o quedan pendientes
  const authorize = historical || type === "FALTA" || fd.get("authorize") === "on";
  if (type === "VACACIONES" && authorize && !historical) await assertVacationBalance(e, days, startDate);
  const by = await who();
  await prisma.incident.create({
    data: {
      employeeId,
      type,
      startDate,
      endDate,
      days,
      withPay: type === "PERMISO" && fd.get("withPay") === "on",
      status: authorize ? "AUTORIZADA" : "PENDIENTE",
      reason,
      source: historical ? "HISTORICO" : "MANUAL",
      decidedAt: authorize ? new Date() : null,
      decidedBy: authorize ? by : "",
      createdBy: by,
    },
  });
  if (authorize && type !== "FALTA") await clearFaltas(employeeId, startDate, endDate);
  refresh(employeeId);
}

/** Quita las faltas injustificadas que quedan cubiertas por un permiso o vacaciones autorizados. */
const clearFaltas = (employeeId: number, from: string, to: string) =>
  prisma.incident.deleteMany({ where: { employeeId, type: "FALTA", startDate: { gte: from }, endDate: { lte: to } } });

/** Justifica una falta: pasa a permiso (con o sin goce de sueldo) con su motivo. */
async function justifyIncidentImpl(id: number, fd: FormData) {
  const i = await prisma.incident.findUniqueOrThrow({ where: { id } });
  if (i.type !== "FALTA") throw new Error("Solo se pueden justificar faltas.");
  const reason = str(fd, "reason");
  if (!reason) throw new Error("Escribe el motivo de la justificación.");
  await prisma.incident.update({
    where: { id },
    data: { type: "PERMISO", withPay: fd.get("withPay") === "on", reason, source: "MANUAL", status: "AUTORIZADA", decidedAt: new Date(), decidedBy: await who() },
  });
  refresh(i.employeeId);
}

/** Autoriza o rechaza una solicitud de vacaciones o permiso. En el descanso por retardos, "rechazar" = perdonarlo. */
async function decideIncidentImpl(id: number, approve: boolean) {
  const i = await prisma.incident.findUniqueOrThrow({ where: { id }, include: { employee: true } });
  if (approve && i.type === "VACACIONES" && i.status !== "AUTORIZADA") await assertVacationBalance(i.employee, i.days, i.startDate);
  await prisma.incident.update({ where: { id }, data: { status: approve ? "AUTORIZADA" : "RECHAZADA", decidedAt: new Date(), decidedBy: await who() } });
  if (approve && (i.type === "VACACIONES" || i.type === "PERMISO")) await clearFaltas(i.employeeId, i.startDate, i.endDate);
  refresh(i.employeeId);
}

/** Cambia el día del descanso por retardos. */
async function moveLateRestImpl(id: number, fd: FormData) {
  const i = await prisma.incident.findUniqueOrThrow({ where: { id }, include: { employee: true } });
  if (i.type !== "DESCANSO_RETARDOS") throw new Error("Solo se puede cambiar el día del descanso por retardos.");
  const d = str(fd, "date");
  if (!DATE.test(d)) throw new Error("Indica el día de descanso.");
  if (!workdaysIn(d, d, i.employee).length) throw new Error("Ese día no es laborable para el empleado.");
  const overlap = await prisma.incident.findFirst({ where: { employeeId: i.employeeId, id: { not: id }, status: { not: "RECHAZADA" }, startDate: { lte: d }, endDate: { gte: d } } });
  if (overlap) throw new Error("Ya hay una incidencia ese día.");
  await prisma.incident.update({ where: { id }, data: { startDate: d, endDate: d } });
  refresh(i.employeeId);
}

/** Elimina una incidencia capturada a mano (el descanso por retardos se cancela en lugar de borrarse). */
async function deleteIncidentImpl(id: number) {
  const i = await prisma.incident.findUniqueOrThrow({ where: { id } });
  if (i.type === "DESCANSO_RETARDOS") throw new Error("El descanso por retardos no se elimina: cancélalo para perdonarlo.");
  await prisma.incident.delete({ where: { id } });
  refresh(i.employeeId);
}

export const createIncident = safe(createIncidentImpl);
export const decideIncident = safe(decideIncidentImpl);
export const justifyIncident = safe(justifyIncidentImpl);
export const moveLateRest = safe(moveLateRestImpl);
export const deleteIncident = safe(deleteIncidentImpl);
