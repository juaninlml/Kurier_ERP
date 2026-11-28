"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ensureGeo } from "@/lib/geocode";
import { prisma } from "@/lib/db";
import { assertSignedIn } from "@/lib/safe-action";
import { getCurrentUser } from "@/lib/current-user";
import { writeAudit } from "@/lib/audit";
import { normalizeTracking } from "@/lib/tracking";
import { getT } from "@/lib/i18n/server";
import { translateError } from "@/lib/user-error";
import { FAIL_REASONS, SERVICE_LEVELS, serviceLevelOf } from "@/lib/lastmile-zones";
import { ACTIVE_LOAD, assignRouteOrder, finishRouteLoad, storageCodeFrom } from "@/lib/route-load";
import { UserError } from "@/lib/user-error";

/*
 * App de reparto (/reparto), un solo flujo guiado (ver src/lib/route-load.ts):
 *   1. Escanear el almacenamiento del transporte → se abre la carga.
 *   2. Escanear los paquetes que van dentro → "En ruta".
 *   3. Cerrar la carga → la app queda solo en Entrega: firma + foto, o intento fallido con motivo.
 *   4. Terminar la ruta → lo no entregado regresa al almacén y la app se desbloquea.
 * El servidor hace cumplir cada paso (no solo la pantalla). Cada acción regresa { ok, … } o { error }.
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

/** Error para la app, en el idioma del repartidor. */
async function fail(e: unknown) {
  const t = await getT();
  return { ok: false as const, error: translateError(e, t) ?? t("No se pudo completar. Intenta de nuevo.") };
}

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
  service: string;
  attempts: number;
  content: string;
  /** Número de parada en el orden de entrega (null mientras se carga). */
  seq: number | null;
  /** Ubicación exacta que dio el cliente (si la hay). */
  lat: number | null;
  lng: number | null;
};

/** Estado de la carga del repartidor (lo que dibuja la app). */
export type LoadState = {
  id: number;
  status: "CARGANDO" | "EN_REPARTO";
  storageName: string;
  storageCode: string;
  items: DeliveryInfo[];
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
  serviceLevel: true,
  attempts: true,
  content: true,
  loadId: true,
  routeSeq: true,
  destLat: true,
  destLng: true,
} as const;

function info(s: Record<string, unknown>): DeliveryInfo {
  const x = s as Record<string, string & number>;
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
    service: SERVICE_LEVELS[serviceLevelOf(x.serviceLevel)],
    attempts: x.attempts,
    content: x.content,
    seq: (s.routeSeq as number | null) ?? null,
    lat: (s.destLat as number | null) ?? null,
    lng: (s.destLng as number | null) ?? null,
  };
}

async function findShipment(code: string) {
  if (storageCodeFrom(code)) throw new Error("Ese es el código de un almacenamiento, no de un paquete. Escanea la guía del paquete.");
  const tracking = trackingFrom(code);
  if (!tracking) throw new Error("No se reconoce el código. Escanea el QR o el código de barras de la guía Kurier.");
  const s = await prisma.shipment.findUnique({ where: { tracking }, select });
  if (!s) throw new UserError("No existe la guía {v0}.", { v0: tracking });
  return s;
}

async function activeLoadOf(driverId: number) {
  return prisma.routeLoad.findFirst({
    where: { driverId, status: { in: ACTIVE_LOAD } },
    include: { storage: { select: { name: true, code: true } } },
    orderBy: { id: "desc" },
  });
}

async function loadState(loadId: number): Promise<LoadState | null> {
  const l = await prisma.routeLoad.findUnique({
    where: { id: loadId },
    include: {
      storage: { select: { name: true, code: true } },
      shipments: { select, orderBy: [{ routeSeq: { sort: "asc", nulls: "last" } }, { loadedAt: "desc" }, { id: "desc" }] },
    },
  });
  if (!l || l.status === "TERMINADA") return null;
  // Rutas cerradas antes de que existiera el orden de entrega: se calcula la primera vez
  if (l.status === "EN_REPARTO" && l.shipments.some((s) => s.routeSeq == null)) {
    await assignRouteOrder(l.id);
    return loadState(loadId);
  }
  return { id: l.id, status: l.status as LoadState["status"], storageName: l.storage.name, storageCode: l.storage.code, items: l.shipments.map(info) };
}

function refresh(shipmentId?: number) {
  revalidatePath("/envios");
  revalidatePath("/envios/almacenamientos");
  if (shipmentId) revalidatePath(`/envios/${shipmentId}`);
}

/** Carga en curso del repartidor (la usa la página al abrir: así el bloqueo sobrevive a recargar o cambiar de teléfono). */
export async function getMyLoad(): Promise<LoadState | null> {
  const { me } = await driver();
  const l = await activeLoadOf(me.id);
  return l ? loadState(l.id) : null;
}

/** Paso 1: escanear el almacenamiento del transporte abre la carga. */
export async function startLoad(code: string): Promise<{ ok: true; load: LoadState } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const mine = await activeLoadOf(me.id);
    if (mine) {
      if (mine.status === "EN_REPARTO") throw new Error("Tienes una ruta en reparto. Termínala antes de cargar otra.");
      // Ya está cargando: seguir con esa misma carga
      return { ok: true, load: (await loadState(mine.id))! };
    }
    const storageCode = storageCodeFrom(code);
    if (!storageCode) {
      if (trackingFrom(code)) throw new Error("Primero escanea la etiqueta del almacenamiento (jaula o caja del transporte); luego los paquetes.");
      throw new Error("No se reconoce el código. Escanea la etiqueta AL-… del almacenamiento.");
    }
    const unit = await prisma.storageUnit.findUnique({ where: { code: storageCode } });
    if (!unit) throw new UserError("No existe el almacenamiento {v0}. Pide que lo den de alta en Envíos → Almacenamientos.", { v0: storageCode });
    if (!unit.active) throw new UserError("El almacenamiento {v0} está desactivado.", { v0: unit.name });
    const other = await prisma.routeLoad.findFirst({ where: { storageId: unit.id, status: { in: ACTIVE_LOAD } }, select: { driverName: true } });
    if (other) throw new UserError("{v0} ya lo está usando {v1}. Escanea otro almacenamiento.", { v0: unit.name, v1: other.driverName });
    const load = await prisma.routeLoad.create({ data: { storageId: unit.id, driverId: me.id, driverName: name } });
    await writeAudit({ user: me, module: "reparto", fnName: "startLoad", args: [load.id], note: { summary: `Abrió la carga de ${unit.name}` }, href: "/envios/almacenamientos" }).catch(() => {});
    refresh();
    return { ok: true, load: (await loadState(load.id))! };
  } catch (e) {
    return await fail(e);
  }
}

/** Paso 2: escanear cada paquete que va en el almacenamiento (pasa a "En ruta"). */
export async function scanLoad(code: string): Promise<{ ok: true; info: DeliveryInfo; again: boolean } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const load = await activeLoadOf(me.id);
    if (!load) throw new Error("Primero escanea la etiqueta del almacenamiento.");
    if (load.status !== "CARGANDO") throw new Error("La carga ya está cerrada: ahora solo puedes entregar.");
    const s = await findShipment(code);
    if (s.status === "CANCELADA") throw new UserError("La guía {v0} está cancelada: no la cargues.", { v0: s.tracking });
    if (s.status === "ENTREGADA") throw new UserError("La guía {v0} ya fue entregada.", { v0: s.tracking });
    if (s.loadId === load.id) return { ok: true, info: info(s), again: true };
    if (s.loadId) {
      const other = await prisma.routeLoad.findUnique({ where: { id: s.loadId }, include: { storage: { select: { name: true } } } });
      if (other && other.status !== "TERMINADA") throw new UserError("La guía {v0} ya va en {v1} ({v2}).", { v0: s.tracking, v1: other.storage.name, v2: other.driverName });
    }
    await prisma.shipment.update({
      where: { id: s.id },
      data: {
        status: "EN_RUTA",
        loadId: load.id,
        routeSeq: null, // el orden se calcula al cerrar la carga
        loadedAt: new Date(),
        loadedBy: name,
        events: { create: { kind: "CARGA", detail: `Cargada en ${load.storage.name} · ${s.status === "EN_RUTA" ? "En ruta" : "Generada → En ruta"}`, by: name } },
      },
    });
    await writeAudit({ user: me, module: "envios", fnName: "scanLoad", args: [s.id], note: { summary: `Cargó ${s.tracking} en ${load.storage.name}` }, href: `/envios/${s.id}` }).catch(() => {});
    refresh(s.id);
    // Ubica la dirección mientras se sigue cargando (así al cerrar la carga el orden sale al instante)
    after(() => ensureGeo([s.id]).catch(() => {}));
    return { ok: true, info: info({ ...s, status: "EN_RUTA" }), again: false };
  } catch (e) {
    return await fail(e);
  }
}

/** Bajar de la carga un paquete escaneado por error (solo mientras se está cargando). */
export async function removeFromLoad(shipmentId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const load = await activeLoadOf(me.id);
    if (!load || load.status !== "CARGANDO") throw new Error("Solo se pueden bajar paquetes mientras la carga está abierta.");
    const s = await prisma.shipment.findUnique({ where: { id: shipmentId }, select: { id: true, tracking: true, loadId: true } });
    if (!s || s.loadId !== load.id) throw new Error("Ese paquete no está en tu carga.");
    await prisma.shipment.update({
      where: { id: s.id },
      data: { status: "GENERADA", loadId: null, routeSeq: null, events: { create: { kind: "DESCARGA", detail: `Se bajó de ${load.storage.name} antes de salir`, by: name } } },
    });
    refresh(s.id);
    return { ok: true };
  } catch (e) {
    return await fail(e);
  }
}

/** Paso 3: cerrar la carga. Desde aquí la app solo deja entregar los paquetes de esta carga. */
export async function closeLoad(): Promise<{ ok: true; load: LoadState } | { ok: false; error: string }> {
  try {
    const { me } = await driver();
    const load = await activeLoadOf(me.id);
    if (!load || load.status !== "CARGANDO") throw new Error("No tienes una carga abierta.");
    const count = await prisma.shipment.count({ where: { loadId: load.id } });
    if (!count) throw new Error("Escanea al menos un paquete antes de cerrar la carga.");
    await prisma.routeLoad.update({ where: { id: load.id }, data: { status: "EN_REPARTO", closedAt: new Date() } });
    // Orden de entrega: 1.ª, 2.ª… parada (ver src/lib/route-order.ts)
    await assignRouteOrder(load.id);
    await writeAudit({ user: me, module: "reparto", fnName: "closeLoad", args: [load.id], note: { summary: `Cerró ${load.storage.name} con ${count} paquete(s) y salió a reparto` }, href: "/envios/almacenamientos" }).catch(() => {});
    refresh();
    return { ok: true, load: (await loadState(load.id))! };
  } catch (e) {
    return await fail(e);
  }
}

/** Cancelar una carga recién abierta y vacía (se escaneó el almacenamiento equivocado). */
export async function cancelEmptyLoad(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { me } = await driver();
    const load = await activeLoadOf(me.id);
    if (!load || load.status !== "CARGANDO") throw new Error("No tienes una carga abierta.");
    if (await prisma.shipment.count({ where: { loadId: load.id } })) throw new Error("La carga ya tiene paquetes: bájalos primero.");
    await prisma.routeLoad.delete({ where: { id: load.id } });
    refresh();
    return { ok: true };
  } catch (e) {
    return await fail(e);
  }
}

/** La guía debe ir en la carga cerrada del repartidor (la app está bloqueada en Entrega). */
async function assertInMyRoute(meId: number, s: { tracking: string; loadId: number | null }) {
  const load = await activeLoadOf(meId);
  if (!load) throw new Error("Primero carga tu almacenamiento y ciérralo; después podrás entregar.");
  if (load.status !== "EN_REPARTO") throw new Error("Cierra la carga antes de entregar.");
  if (s.loadId !== load.id) throw new UserError("La guía {v0} no va en tu carga ({v1}).", { v0: s.tracking, v1: load.storage.name });
  return load;
}

/** Escaneo al entregar: muestra los datos de la entrega antes de pedir firma y foto. */
export async function lookupDelivery(code: string): Promise<{ ok: true; info: DeliveryInfo } | { ok: false; error: string }> {
  try {
    const { me } = await driver();
    const s = await findShipment(code);
    await assertInMyRoute(me.id, s);
    if (s.status === "CANCELADA") throw new UserError("La guía {v0} está cancelada.", { v0: s.tracking });
    if (s.status === "ENTREGADA") throw new UserError("La guía {v0} ya fue entregada.", { v0: s.tracking });
    return { ok: true, info: info(s) };
  } catch (e) {
    return await fail(e);
  }
}

const MAX_IMAGE = 2_500_000; // bytes (la app comprime la foto a ~1600 px antes de subirla)

async function imageOf(fd: FormData, key: string, kinds: string[], label: string) {
  const f = fd.get(key);
  if (!(f instanceof File) || f.size === 0) throw new UserError("Falta {v0}.", { v0: label });
  if (!kinds.includes(f.type)) throw new UserError("Formato no válido en {v0}.", { v0: label });
  if (f.size > MAX_IMAGE) throw new UserError("Pesa demasiado {v0}; vuelve a tomarla.", { v0: label });
  const bytes = Buffer.from(await f.arrayBuffer());
  // El tipo real sale de los primeros bytes (no del que declara el navegador) y es el que se guarda
  const mime = imageMime(bytes);
  if (!mime || !kinds.includes(mime)) throw new UserError("Formato no válido en {v0}.", { v0: label });
  return { bytes, mime };
}

function imageMime(b: Buffer) {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Confirma la entrega: quién recibió, firma y foto. La guía pasa a "Entregada". */
export async function confirmDelivery(fd: FormData): Promise<{ ok: true; tracking: string } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const s = await findShipment(String(fd.get("tracking") ?? ""));
    await assertInMyRoute(me.id, s);
    if (s.status === "ENTREGADA") throw new UserError("La guía {v0} ya fue entregada.", { v0: s.tracking });
    if (s.status === "CANCELADA") throw new UserError("La guía {v0} está cancelada.", { v0: s.tracking });
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
          events: { create: { kind: "ENTREGA", detail: `Entregada · recibió ${receiver} · con firma y foto`, by: name } },
        },
      }),
    ]);
    await writeAudit({ user: me, module: "envios", fnName: "confirmDelivery", args: [s.id], note: { summary: `Entregó ${s.tracking}` }, href: `/envios/${s.id}` }).catch(() => {});
    refresh(s.id);
    return { ok: true, tracking: s.tracking };
  } catch (e) {
    return await fail(e);
  }
}

/** Intento de entrega fallido: suma el intento (casillas 1-2-3 de la guía) y queda en la bitácora. */
export async function failedAttempt(tracking: string, reason: string, note: string): Promise<{ ok: true; attempts: number } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const s = await findShipment(tracking);
    await assertInMyRoute(me.id, s);
    if (s.status === "ENTREGADA" || s.status === "CANCELADA") throw new UserError("La guía {v0} ya no está en reparto.", { v0: s.tracking });
    if (!(FAIL_REASONS as readonly string[]).includes(reason)) throw new Error("Elige el motivo.");
    if (reason === "Otro" && !note.trim()) throw new Error("Escribe qué pasó.");
    const attempts = s.attempts + 1;
    await prisma.shipment.update({
      where: { id: s.id },
      data: { attempts, events: { create: { kind: "INTENTO", detail: `Intento ${attempts} sin entregar: ${reason}${note.trim() ? ` — ${note.trim().slice(0, 200)}` : ""}`, by: name } } },
    });
    await writeAudit({ user: me, module: "envios", fnName: "failedAttempt", args: [s.id], note: { summary: `Intento ${attempts} de ${s.tracking}` }, href: `/envios/${s.id}` }).catch(() => {});
    refresh(s.id);
    return { ok: true, attempts };
  } catch (e) {
    return await fail(e);
  }
}

/** Paso 4: terminar la ruta. Lo no entregado regresa al almacén y la app se desbloquea. */
export async function finishMyLoad(): Promise<{ ok: true; returned: number } | { ok: false; error: string }> {
  try {
    const { me, name } = await driver();
    const load = await activeLoadOf(me.id);
    if (!load || load.status !== "EN_REPARTO") throw new Error("No tienes una ruta en reparto.");
    const { returned } = await finishRouteLoad(load.id, name);
    await writeAudit({ user: me, module: "reparto", fnName: "finishMyLoad", args: [load.id], note: { summary: `Terminó la ruta de ${load.storage.name}${returned ? ` · ${returned} paquete(s) regresan al almacén` : ""}` }, href: "/envios/almacenamientos" }).catch(() => {});
    refresh();
    return { ok: true, returned };
  } catch (e) {
    return await fail(e);
  }
}
