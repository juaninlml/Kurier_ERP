"use server";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorizeTotp } from "@/auth";
import { safe, safePublic } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/current-user";
import { decryptSecret, encryptSecret, newSecret, verifyCode } from "@/lib/totp";
import { autoCloseShifts, localParts, nextAction, PUNCH_LABEL, PUNCH_TYPES, toMin, validAlternatives, zonedTime, type PunchType } from "@/lib/attendance";
import { LATES_PER_REST, monthLates } from "@/lib/incidents";
import { numv, str } from "./helpers";
import { UserError } from "@/lib/user-error";

const KIOSK_COOKIE = "kurier_kiosk";
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function settings() {
  const s = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true, lateToleranceMin: true, autoCloseMin: true } });
  return { tz: s?.timezone || "America/Mexico_City", tolerance: s?.lateToleranceMin ?? 10, grace: s?.autoCloseMin ?? 5 };
}

/** Tablet autorizada (por la cookie del kiosco). */
async function currentDevice() {
  const token = (await cookies()).get(KIOSK_COOKIE)?.value;
  if (!token) return null;
  const d = await prisma.kioskDevice.findUnique({ where: { tokenHash: sha(token) } });
  return d?.active ? d : null;
}

/** Comprobante corto para corregir el tipo de checada desde el kiosco (válido 90 s). */
const ticketFor = (punchId: number) => createHmac("sha256", process.env.AUTH_SECRET ?? "kiosk").update(`punch:${punchId}`).digest("base64url").slice(0, 24);

export type KioskResult =
  | {
      ok: true;
      punchId: number;
      ticket: string;
      name: string;
      position: string;
      area: string;
      type: PunchType;
      label: string;
      time: string;
      lateMin: number;
      message: string;
      alternatives: { type: PunchType; label: string }[];
    }
  | { ok: false; error: string };

/** Checada desde el kiosco: solo con el código de 6 dígitos del autenticador del empleado. */
export async function kioskPunch(code: string): Promise<KioskResult> {
  const device = await currentDevice();
  if (!device) return { ok: false, error: "Esta tablet no está autorizada como kiosco." };
  const now = new Date();
  if (device.lockedUntil && device.lockedUntil > now) return { ok: false, error: "Demasiados códigos incorrectos. Espera un minuto." };
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return { ok: false, error: "Escribe los 6 dígitos de tu app." };

  await autoCloseShifts(now);
  const employees = await prisma.employee.findMany({ where: { active: true, NOT: { kioskSecret: "" } } });
  const matches: { e: (typeof employees)[number]; step: number }[] = [];
  for (const e of employees) {
    try {
      const step = verifyCode(decryptSecret(e.kioskSecret), clean, e.kioskLastStep);
      if (step !== null) matches.push({ e, step });
    } catch {
      /* secreto dañado: se ignora */
    }
  }
  if (matches.length !== 1) {
    if (matches.length === 0) {
      const failed = device.failedAttempts + 1;
      await prisma.kioskDevice.update({
        where: { id: device.id },
        data: failed >= 10 ? { failedAttempts: 0, lockedUntil: new Date(now.getTime() + 60000) } : { failedAttempts: failed },
      });
      return { ok: false, error: "Código no válido o ya usado. Espera el siguiente código de tu app." };
    }
    return { ok: false, error: "Espera a que tu app muestre el siguiente código e inténtalo de nuevo." };
  }

  const { e, step } = matches[0];
  const { tz, tolerance } = await settings();
  const { date: today, minutes: nowMin } = localParts(now, tz);
  const punches = await prisma.punch.findMany({ where: { employeeId: e.id, workDate: today, deleted: false }, orderBy: { at: "asc" } });
  const type = nextAction(punches, e, nowMin);
  await prisma.employee.update({ where: { id: e.id }, data: { kioskLastStep: step } });
  await prisma.kioskDevice.update({ where: { id: device.id }, data: { failedAttempts: 0, lastSeenAt: now } });

  const fmtTime = (d: Date) => d.toLocaleTimeString("es-MX", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  if (!type) {
    const out = punches.at(-1)!;
    return {
      ok: false,
      error: out.source === "AUTO" ? `${e.name}: tu salida se registró automáticamente a las ${fmtTime(out.at)}.` : `${e.name}: tu jornada de hoy ya terminó (salida ${fmtTime(out.at)}).`,
    };
  }

  // Después de la hora de salida, solo se puede seguir trabajando con horas extra autorizadas
  if (type !== "SALIDA") {
    const ot = await prisma.overtimeAuth.findUnique({ where: { employeeId_workDate: { employeeId: e.id, workDate: today } } });
    if (punches.length > 0 && nowMin > toMin(ot?.until ?? e.scheduleEnd)) {
      return { ok: false, error: `${e.name}: ya pasó tu hora de salida. Las horas extra requieren autorización.` };
    }
  }

  const punch = await prisma.punch.create({ data: { employeeId: e.id, type, at: now, workDate: today, source: "KIOSCO", deviceId: device.id } });
  const lateMin = type === "ENTRADA" ? Math.max(0, Math.round(nowMin - toMin(e.scheduleStart))) : 0;
  // Retardos acumulados del mes: cada 3 = un día de descanso sin goce la semana siguiente
  let lateNote = "";
  if (type === "ENTRADA" && lateMin > tolerance) {
    const n = (await monthLates(e.id, today.slice(0, 7), today)).length;
    const k = ((n - 1) % LATES_PER_REST) + 1;
    if (n > 0)
      lateNote = k === LATES_PER_REST ? ` Retardo ${k} de ${LATES_PER_REST} del mes: te toca un día de descanso sin goce la próxima semana.` : ` Retardo ${k} de ${LATES_PER_REST} del mes.`;
  }
  const messages: Record<PunchType, string> = {
    ENTRADA: lateMin > tolerance ? `Llegaste ${lateMin} min tarde (entrada ${e.scheduleStart}).${lateNote}` : "¡Buen día!",
    SALIDA_COMIDA: `Provecho. Regreso antes de las ${e.mealEnd}.`,
    REGRESO_COMIDA: "Bienvenido de regreso.",
    SALIDA: "¡Hasta mañana!",
  };
  return {
    ok: true,
    punchId: punch.id,
    ticket: ticketFor(punch.id),
    name: e.name,
    position: e.position,
    area: e.area,
    type,
    label: PUNCH_LABEL[type],
    time: fmtTime(now),
    lateMin,
    message: messages[type],
    alternatives: validAlternatives([...punches, punch], type).map((t) => ({ type: t, label: PUNCH_LABEL[t] })),
  };
}

/** Corrige el tipo de la última checada (botón "¿No era…?" del kiosco, hasta 90 s después). */
export async function kioskChangeType(punchId: number, ticket: string, type: string): Promise<KioskResult> {
  const device = await currentDevice();
  if (!device) return { ok: false, error: "Esta tablet no está autorizada como kiosco." };
  if (ticket !== ticketFor(punchId) || !(PUNCH_TYPES as readonly string[]).includes(type)) return { ok: false, error: "No se pudo corregir." };
  const p = await prisma.punch.findUnique({ where: { id: punchId }, include: { employee: true } });
  if (!p || p.deviceId !== device.id || Date.now() - p.createdAt.getTime() > 90000) return { ok: false, error: "Ya no se puede corregir desde el kiosco; pide la corrección a tu supervisor." };
  const { tz } = await settings();
  await prisma.punch.update({ where: { id: punchId }, data: { type, note: "Corregido en el kiosco" } });
  return {
    ok: true,
    punchId,
    ticket,
    name: p.employee.name,
    position: p.employee.position,
    area: p.employee.area,
    type: type as PunchType,
    label: PUNCH_LABEL[type],
    time: p.at.toLocaleTimeString("es-MX", { timeZone: tz, hour: "2-digit", minute: "2-digit" }),
    lateMin: 0,
    message: "Checada corregida.",
    alternatives: [],
  };
}

/** Llamada periódica del kiosco: cierra jornadas vencidas y marca la tablet como activa. */
export async function kioskHeartbeat() {
  const device = await currentDevice();
  if (!device) return { ok: false };
  await autoCloseShifts();
  await prisma.kioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return { ok: true };
}

// ───────────── Autorización de tablets ─────────────

/** Guarda en la tablet la cookie de kiosco (dura 2 años) y la liga al dispositivo. */
async function bindDevice(deviceId: number) {
  const secret = randomBytes(32).toString("base64url");
  await prisma.kioskDevice.update({ where: { id: deviceId }, data: { tokenHash: sha(secret), activationToken: "", lastSeenAt: new Date() } });
  const secure = process.env.NODE_ENV === "production";
  (await cookies()).set(KIOSK_COOKIE, secret, { httpOnly: true, sameSite: "lax", secure, maxAge: 60 * 60 * 24 * 730, path: "/" });
}

/** Activa la tablet con el link o QR generado en Asistencias (se usa una sola vez). */
async function activateKioskImpl(token: string) {
  const device = token ? await prisma.kioskDevice.findFirst({ where: { activationToken: token, active: true } }) : null;
  if (!device) throw new Error("El link ya se usó o fue cancelado. Genera uno nuevo en Nómina → Asistencias → Kioscos.");
  await bindDevice(device.id);
  redirect("/kiosco");
}

/** Autoriza la tablet desde la propia tablet con el correo y el código del autenticador de un administrador. */
async function pairKioskImpl(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const code = str(fd, "code");
  if (!email || !code) throw new Error("Escribe tu correo y el código de tu app autenticadora.");
  const ok = await authorizeTotp(email, code);
  const user = ok ? await prisma.user.findUnique({ where: { email }, select: { role: true } }) : null;
  if (!ok || !user) throw new Error("Correo o código incorrecto (o la cuenta está bloqueada unos minutos).");
  if (user.role !== "OWNER" && user.role !== "ADMIN") throw new Error("Solo un administrador puede autorizar tablets.");
  const name = str(fd, "name") || "Tablet";
  const device = await prisma.kioskDevice.create({ data: { name, tokenHash: sha(randomBytes(32).toString("base64url")), activationToken: "" } });
  await bindDevice(device.id);
  refresh();
  redirect("/kiosco");
}

// ───────────── Administración ─────────────

const refresh = () => {
  revalidatePath("/nomina/asistencias", "layout");
  revalidatePath("/nomina");
};

async function createKioskDeviceImpl(fd: FormData) {
  await requireAdmin();
  const name = str(fd, "name") || "Tablet";
  await prisma.kioskDevice.create({ data: { name, tokenHash: sha(randomBytes(32).toString("base64url")), activationToken: randomBytes(24).toString("base64url") } });
  refresh();
}

async function setKioskDeviceActiveImpl(id: number, active: boolean) {
  await requireAdmin();
  await prisma.kioskDevice.update({ where: { id }, data: { active, ...(active ? {} : { activationToken: "" }) } });
  refresh();
}

/** Genera el QR del autenticador del kiosco para un empleado (queda pendiente hasta confirmar el código). */
async function startEmployeeKioskImpl(employeeId: number) {
  await requireAdmin();
  await prisma.employee.update({ where: { id: employeeId }, data: { kioskPendingSecret: encryptSecret(newSecret()) } });
  revalidatePath(`/nomina/empleados/${employeeId}`);
}

async function confirmEmployeeKioskImpl(employeeId: number, fd: FormData) {
  await requireAdmin();
  const e = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  if (!e.kioskPendingSecret) throw new Error("Primero genera el código QR.");
  const step = verifyCode(decryptSecret(e.kioskPendingSecret), str(fd, "code"));
  if (step === null) throw new Error("El código no coincide. Revisa que la hora del teléfono sea automática y escribe el código actual.");
  await prisma.employee.update({ where: { id: employeeId }, data: { kioskSecret: e.kioskPendingSecret, kioskPendingSecret: "", kioskLastStep: step } });
  revalidatePath(`/nomina/empleados/${employeeId}`);
}

async function unlinkEmployeeKioskImpl(employeeId: number) {
  await requireAdmin();
  await prisma.employee.update({ where: { id: employeeId }, data: { kioskSecret: "", kioskPendingSecret: "", kioskLastStep: 0 } });
  revalidatePath(`/nomina/empleados/${employeeId}`);
}

async function authorizeOvertimeImpl(fd: FormData) {
  const user = await requireAdmin();
  const employeeId = numv(fd, "employeeId");
  const workDate = str(fd, "workDate");
  const until = str(fd, "until");
  if (!employeeId || !DATE.test(workDate)) throw new Error("Elige el empleado y el día.");
  if (!HHMM.test(until)) throw new Error("Indica hasta qué hora (HH:MM).");
  const e = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  if (toMin(until) <= toMin(e.scheduleEnd)) throw new UserError("La hora debe ser después de su salida ({v0}).", { v0: e.scheduleEnd });
  await prisma.overtimeAuth.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    create: { employeeId, workDate, until, note: str(fd, "note"), approvedById: user.id },
    update: { until, note: str(fd, "note"), approvedById: user.id },
  });
  refresh();
}

async function deleteOvertimeImpl(id: number) {
  await requireAdmin();
  await prisma.overtimeAuth.delete({ where: { id } });
  refresh();
}

/** Corrección manual (olvido de checada): se registra quién la hizo y por qué. */
async function addManualPunchImpl(fd: FormData) {
  const user = await requireAdmin();
  const employeeId = numv(fd, "employeeId");
  const workDate = str(fd, "workDate");
  const time = str(fd, "time");
  const type = str(fd, "type");
  const note = str(fd, "note");
  if (!employeeId || !DATE.test(workDate) || !HHMM.test(time)) throw new Error("Indica empleado, día y hora.");
  if (!(PUNCH_TYPES as readonly string[]).includes(type)) throw new Error("Tipo de checada inválido.");
  if (!note) throw new Error("Escribe el motivo de la corrección.");
  const { tz } = await settings();
  await prisma.punch.create({ data: { employeeId, type, workDate, at: zonedTime(workDate, time, tz), source: "MANUAL", note, createdById: user.id } });
  refresh();
}

async function deletePunchImpl(id: number) {
  const user = await requireAdmin();
  const p = await prisma.punch.findUniqueOrThrow({ where: { id } });
  await prisma.punch.update({ where: { id }, data: { deleted: true, note: `${p.note ? `${p.note} · ` : ""}Anulada por ${user.name || user.email}` } });
  refresh();
}

async function saveAttendanceSettingsImpl(fd: FormData) {
  await requireAdmin();
  await prisma.companySettings.update({
    where: { id: 1 },
    data: {
      lateToleranceMin: Math.max(0, Math.round(numv(fd, "lateToleranceMin", 10))),
      autoCloseMin: Math.max(0, Math.round(numv(fd, "autoCloseMin", 5))),
      overtimeRate: Math.max(1, numv(fd, "overtimeRate", 2)),
    },
  });
  refresh();
}

/** Resincroniza la vista (ej. botón "Actualizar" en Asistencias): cierra jornadas vencidas. */
async function runAutoCloseImpl() {
  await getCurrentUser();
  await autoCloseShifts();
  refresh();
}

export const createKioskDevice = safe(createKioskDeviceImpl, "nomina", "createKioskDeviceImpl");
export const activateKiosk = safePublic(activateKioskImpl);
export const pairKiosk = safePublic(pairKioskImpl);
export const deactivateKioskDevice = safe(async (id: number) => setKioskDeviceActiveImpl(id, false), "nomina", "deactivateKioskDevice");
export const startEmployeeKiosk = safe(startEmployeeKioskImpl, "nomina", "startEmployeeKioskImpl");
export const confirmEmployeeKiosk = safe(confirmEmployeeKioskImpl, "nomina", "confirmEmployeeKioskImpl");
export const unlinkEmployeeKiosk = safe(unlinkEmployeeKioskImpl, "nomina", "unlinkEmployeeKioskImpl");
export const authorizeOvertime = safe(authorizeOvertimeImpl, "nomina", "authorizeOvertimeImpl");
export const deleteOvertime = safe(deleteOvertimeImpl, "nomina", "deleteOvertimeImpl");
export const addManualPunch = safe(addManualPunchImpl, "nomina", "addManualPunchImpl");
export const deletePunch = safe(deletePunchImpl, "nomina", "deletePunchImpl");
export const saveAttendanceSettings = safe(saveAttendanceSettingsImpl, "nomina", "saveAttendanceSettingsImpl");
export const runAutoClose = safe(runAutoCloseImpl, "nomina", "runAutoCloseImpl");
