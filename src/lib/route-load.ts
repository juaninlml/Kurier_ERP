import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { orderStops } from "./route-order";

/*
 * Cargas de ruta. Flujo del repartidor en /reparto:
 *   1. Escanea el código del almacenamiento del transporte → se abre una carga (CARGANDO).
 *   2. Escanea los paquetes que van dentro → cada guía queda ligada a la carga y pasa a "En ruta".
 *   3. Cierra la carga → EN_REPARTO: la app ya solo muestra Entrega (lista de su carga) hasta terminar.
 *   4. Termina la ruta → TERMINADA: lo que no se entregó regresa a "Generada" (vuelve al almacén).
 */

export const LOAD_STATUS: Record<string, string> = { CARGANDO: "Cargando", EN_REPARTO: "En reparto", TERMINADA: "Terminada" };
export const ACTIVE_LOAD = ["CARGANDO", "EN_REPARTO"];

// Sin letras ni números que se confundan al leerlos (0/O, 1/I/L)
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** Código nuevo de almacenamiento: AL-XXXX-XXXX (no se repite). */
export async function newStorageCode() {
  for (let i = 0; i < 10; i++) {
    const code = `AL-${block()}-${block()}`;
    if (!(await prisma.storageUnit.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("No se pudo generar un código. Intenta de nuevo.");
}

/** Código de almacenamiento a partir de lo escaneado (QR "AL-XXXX-XXXX" o código de barras "ALXXXXXXXX"). */
export function storageCodeFrom(raw: string) {
  const m = raw.toUpperCase().match(/AL-?([A-Z0-9]{4})-?([A-Z0-9]{4})/);
  return m ? `AL-${m[1]}-${m[2]}` : "";
}

/**
 * Termina la carga: lo entregado queda como está; lo que sigue "En ruta" regresa a "Generada"
 * (el paquete vuelve al almacén) con su evento en el historial de la guía.
 */
export async function finishRouteLoad(loadId: number, by: string) {
  const load = await prisma.routeLoad.findUniqueOrThrow({ where: { id: loadId }, include: { storage: { select: { name: true } } } });
  if (load.status === "TERMINADA") return { returned: 0, load };
  const pending = await prisma.shipment.findMany({ where: { loadId, status: "EN_RUTA" }, select: { id: true } });
  await prisma.$transaction([
    ...pending.map((s) =>
      prisma.shipment.update({
        where: { id: s.id },
        data: {
          status: "GENERADA",
          events: { create: { kind: "DESCARGA", detail: `Regresó al almacén sin entregar · fin de ruta (${load.storage.name})`, by } },
        },
      }),
    ),
    prisma.routeLoad.update({ where: { id: loadId }, data: { status: "TERMINADA", finishedAt: new Date(), finishedBy: by } }),
  ]);
  return { returned: pending.length, load };
}

/**
 * Calcula y guarda el orden de entrega (routeSeq 1…n) de las guías de una carga.
 * Todas las rutas salen de la base: Castilla 262, Col. Álamos (DEPOT en src/lib/route-order.ts).
 */
export async function assignRouteOrder(loadId: number) {
  const stops = await prisma.shipment.findMany({
    where: { loadId },
    select: { id: true, destZip: true, borough: true, destColony: true, destStreet: true, destNumber: true, destLat: true, destLng: true },
  });
  const order = orderStops(stops.map((s) => ({ id: s.id, zip: s.destZip, borough: s.borough, colony: s.destColony, street: s.destStreet, number: s.destNumber, lat: s.destLat, lng: s.destLng })));
  await prisma.$transaction(order.map((id, i) => prisma.shipment.update({ where: { id }, data: { routeSeq: i + 1 } })));
  return order.length;
}
