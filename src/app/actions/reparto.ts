"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertSignedIn } from "@/lib/safe-action";
import { getCurrentUser } from "@/lib/current-user";
import { writeAudit } from "@/lib/audit";
import { normalizeTracking } from "@/lib/tracking";
import { FAIL_REASONS, SERVICE_LEVELS, serviceLevelOf } from "@/lib/lastmile-zones";

/*
 * App de reparto (/reparto): el repartidor escanea la guía al cargar el vehículo (pasa a "En ruta")
 * y al entregar (firma + foto → "Entregada"). Si no se puede entregar, registra el intento con su motivo.
 * Cada acción regresa { ok, … } o { error } para mostrarse en el celular sin recargar.
 */

/** Saca el número de guía de lo escaneado: el QR trae el link de rastreo; el código de barras, "LMXXXXXXXX". */
function trackingFrom(code: string) {
  const m = code.toUpperCase().match(/LM-?[A-Z0-9]{4}-?[A-Z0-9]{4}/);
  return m ? normalizeTracking(m[0]) : "";
}

async function driver() {
  await assertSignedIn("reparto");
  const me = await getCurrentUser();
  return { me, name: me.name || me.email };
}

const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "No se pudo completar. Intenta de nuevo." });

export type DeliveryInfo = {
  id: number;
  tracking: string;
  status: string;
  destName: string;
  destPhone: string;
  address: string;
  destRef: string;
  borough: string;
  zone: number;
  packages: number;
  cod: number;
  service: string;
  attempts: number;
  content: string;
};

const select = {
  id: true,
  tracking: true,
  status: true,
  destName: true,
  destPhone: true,
  destStreet: true,
  destNumber: true,
  destColony: true,
  destZip: true,
  destRef: true,
  borough: true,
  zone: true,
  packages: true,
  cod: true,
  serviceLevel: true,
  attempts: true,
  content: true,
} as const;

function info(s: { [K in keyof typeof select]: unknown } & Record<string, unknown>): DeliveryInfo {
  const x = s as unknown as Record<string, string & number>;
  return {
    id: x.id,
    tracking: x.tracking,
    status: x.status,
    destName: x.destName,
    destPhone: x.destPhone,
    address: [`${x.destStreet} ${x.destNumber}`.trim(), x.destColony && `Col. ${x.destColony}`, `${x.borough}, CP ${x.destZip}`].filter(Boolean).join(", "),
    destRef: x.destRef,
    borough: x.borough,
    zone: x.zone,
    packages: x.packages,
    cod: x.cod,
    service: SERVICE_LEVELS[serviceLevelOf(x.serviceLevel)],
    attempts: x.attempts,
    content: x.content,
  };
}

async function find(code: string) {
  const tracking = trackingFrom(code);
  if (!tracking) throw new Error("No se reconoce el código. Escanea el QR o el código de barras de la guía Kurier.");
  const s = await prisma.shipment.findUnique({ where: { tracking }, select });
  if (!s) throw new Error(`No existe la guía ${tracking}.`);
  return s;
}

/** Escaneo al cargar el vehículo: la guía pasa a "En ruta". */
export async function scanLoad(code: string): Promise<{ ok: true; info: DeliveryInfo; again: boolean } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const s = await find(code);
    if (s.status === "CANCELADA") throw new Error(`La guía ${s.tracking} está cancelada: no la cargues.`);
    if (s.status === "ENTREGADA") throw new Error(`La guía ${s.tracking} ya fue entregada.`);
    const again = s.status === "EN_RUTA";
    await prisma.shipment.update({
      where: { id: s.id },
      data: {
        status: "EN_RUTA",
        loadedAt: new Date(),
        loadedBy: name,
        events: { create: { kind: "CARGA", detail: again ? `Escaneada de nuevo al cargar (${name})` : `Cargada al vehículo · Generada → En ruta`, by: name } },
      },
    });
    await writeAudit({ user: me, module: "envios", fnName: "scanLoad", args: [s.id], note: { summary: `Cargó ${s.tracking}` }, href: `/envios/${s.id}` }).catch(() => {});
    revalidatePath("/envios");
    revalidatePath(`/envios/${s.id}`);
    return { ok: true, info: info({ ...s, status: "EN_RUTA" }), again };
  } catch (e) {
    return fail(e);
  }
}

/** Escaneo al entregar: muestra los datos de la entrega antes de pedir firma y foto. */
export async function lookupDelivery(code: string): Promise<{ ok: true; info: DeliveryInfo } | { ok: false; error: string }> {
  try {
    await driver();
    const s = await find(code);
    if (s.status === "CANCELADA") throw new Error(`La guía ${s.tracking} está cancelada.`);
    if (s.status === "ENTREGADA") throw new Error(`La guía ${s.tracking} ya fue entregada.`);
    return { ok: true, info: info(s) };
  } catch (e) {
    return fail(e);
  }
}

const MAX_IMAGE = 2_500_000; // bytes (la app comprime la foto a ~1600 px antes de subirla)

async function imageOf(fd: FormData, key: string, kinds: string[], label: string) {
  const f = fd.get(key);
  if (!(f instanceof File) || f.size === 0) throw new Error(`Falta ${label}.`);
  if (!kinds.includes(f.type)) throw new Error(`${label[0].toUpperCase()}${label.slice(1)}: formato no válido.`);
  if (f.size > MAX_IMAGE) throw new Error(`${label[0].toUpperCase()}${label.slice(1)} es muy pesada; vuelve a tomarla.`);
  return { bytes: Buffer.from(await f.arrayBuffer()), mime: f.type };
}

/** Confirma la entrega: quién recibió, firma y foto. La guía pasa a "Entregada". */
export async function confirmDelivery(fd: FormData): Promise<{ ok: true; tracking: string } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const s = await find(String(fd.get("tracking") ?? ""));
    if (s.status === "ENTREGADA") throw new Error(`La guía ${s.tracking} ya fue entregada.`);
    if (s.status === "CANCELADA") throw new Error(`La guía ${s.tracking} está cancelada.`);
    const receiver = String(fd.get("receiverName") ?? "").trim();
    if (receiver.length < 2) throw new Error("Escribe el nombre de quien recibe.");
    const signature = await imageOf(fd, "signature", ["image/png"], "la firma");
    const photo = await imageOf(fd, "photo", ["image/jpeg", "image/png", "image/webp"], "la foto de entrega");
    await prisma.$transaction([
      prisma.shipmentProof.upsert({
        where: { shipmentId: s.id },
        create: { shipmentId: s.id, signature: signature.bytes, signatureMime: signature.mime, photo: photo.bytes, photoMime: photo.mime },
        update: { signature: signature.bytes, signatureMime: signature.mime, photo: photo.bytes, photoMime: photo.mime, createdAt: new Date() },
      }),
      prisma.shipment.update({
        where: { id: s.id },
        data: {
          status: "ENTREGADA",
          deliveredAt: new Date(),
          deliveredBy: name,
          receiverName: receiver.slice(0, 120),
          events: { create: { kind: "ENTREGA", detail: `Entregada · recibió ${receiver} · con firma y foto${s.cod > 0 ? ` · cobro contra entrega $${s.cod.toFixed(2)}` : ""}`, by: name } },
        },
      }),
    ]);
    await writeAudit({ user: me, module: "envios", fnName: "confirmDelivery", args: [s.id], note: { summary: `Entregó ${s.tracking}` }, href: `/envios/${s.id}` }).catch(() => {});
    revalidatePath("/envios");
    revalidatePath(`/envios/${s.id}`);
    return { ok: true, tracking: s.tracking };
  } catch (e) {
    return fail(e);
  }
}

/** Intento de entrega fallido: suma el intento (casillas 1-2-3 de la guía) y queda en la bitácora. */
export async function failedAttempt(tracking: string, reason: string, note: string): Promise<{ ok: true; attempts: number } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const s = await find(tracking);
    if (s.status === "ENTREGADA" || s.status === "CANCELADA") throw new Error(`La guía ${s.tracking} ya no está en reparto.`);
    if (!(FAIL_REASONS as readonly string[]).includes(reason)) throw new Error("Elige el motivo.");
    if (reason === "Otro" && !note.trim()) throw new Error("Escribe qué pasó.");
    const attempts = s.attempts + 1;
    await prisma.shipment.update({
      where: { id: s.id },
      data: { attempts, events: { create: { kind: "INTENTO", detail: `Intento ${attempts} sin entregar: ${reason}${note.trim() ? ` — ${note.trim().slice(0, 200)}` : ""}`, by: name } } },
    });
    await writeAudit({ user: me, module: "envios", fnName: "failedAttempt", args: [s.id], note: { summary: `Intento ${attempts} de ${s.tracking}` }, href: `/envios/${s.id}` }).catch(() => {});
    revalidatePath(`/envios/${s.id}`);
    return { ok: true, attempts };
  } catch (e) {
    return fail(e);
  }
}
