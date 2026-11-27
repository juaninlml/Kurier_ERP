import { prisma } from "./db";
import { inCdmx, type LatLng } from "./geo-link";
import { boroughOfZip } from "./lastmile-zones";
import { BOROUGH_CENTER, km } from "./route-order";

/*
 * Ubicación aproximada de una dirección de destino con OpenStreetMap (Nominatim), solo para ordenar la ruta.
 * Si el cliente mandó su link de ubicación (destLat/destLng) se usa ese y aquí no se hace nada.
 *
 *   1. Calle + número + CP  →  "calle"
 *   2. Calle + número + colonia (texto libre)  →  "calle"
 *   3. Solo el CP (centro del código postal)  →  "cp"
 * Se descarta un punto fuera de la CDMX o a más de 12 km del centro de la alcaldía del CP.
 * A Nominatim solo se manda la dirección (sin nombre ni teléfono), máximo una consulta por segundo.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const UA = "KurierERP/1.0 (planeacion de rutas de reparto)";
const GAP_MS = 1100; // política de uso de Nominatim: máx. 1 consulta por segundo

export type GeoAddress = { street: string; number: string; colony: string; zip: string; borough: string };
export type GeoResult = { lat: number; lng: number; level: "calle" | "cp" } | null;

/** Dirección normalizada: si cambia, la ubicación se vuelve a calcular. */
export const geoKeyOf = (a: GeoAddress) => [a.street, a.number, a.colony, a.zip].map((v) => v.trim().toLowerCase().replace(/\s+/g, " ")).join("|");

// Cola global: las consultas salen una tras otra, con al menos GAP_MS entre ellas
let queue: Promise<unknown> = Promise.resolve();
let last = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      last = Date.now();
    }
  });
  queue = run.catch(() => {});
  return run;
}

const zipCache = new Map<string, LatLng | null>();

async function search(params: Record<string, string>): Promise<LatLng | null> {
  const url = `${ENDPOINT}?${new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "mx", "accept-language": "es", ...params })}`;
  return throttled(async () => {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    return hit ? { lat: Math.round(Number(hit.lat) * 1e6) / 1e6, lng: Math.round(Number(hit.lon) * 1e6) / 1e6 } : null;
  });
}

/** ¿El punto es creíble para esa dirección? (dentro de la CDMX y cerca de la alcaldía del CP) */
function plausible(p: LatLng | null, borough: string): p is LatLng {
  if (!p || !inCdmx(p)) return false;
  const center = BOROUGH_CENTER[borough];
  return !center || km(p, center) <= 12;
}

export async function geocodeAddress(a: GeoAddress): Promise<GeoResult> {
  const borough = a.borough || boroughOfZip(a.zip);
  const street = `${a.number.trim()} ${a.street.trim()}`.trim();
  if (a.street.trim()) {
    const p1 = await search({ street, postalcode: a.zip, city: "Ciudad de México" });
    if (plausible(p1, borough)) return { ...p1, level: "calle" };
    const q = [`${a.street.trim()} ${a.number.trim()}`.trim(), a.colony.trim(), a.zip, borough, "Ciudad de México"].filter(Boolean).join(", ");
    const p2 = await search({ q });
    if (plausible(p2, borough)) return { ...p2, level: "calle" };
  }
  if (!/^\d{5}$/.test(a.zip)) return null;
  if (!zipCache.has(a.zip)) zipCache.set(a.zip, await search({ postalcode: a.zip, country: "México" }));
  const p3 = zipCache.get(a.zip) ?? null;
  return plausible(p3, borough) ? { ...p3, level: "cp" } : null;
}

/**
 * Calcula y guarda la ubicación aproximada de las guías que no tienen link del cliente o cuya dirección cambió.
 * `budgetMs` corta la espera (lo que falte se queda con el centro de su alcaldía). Nunca lanza error.
 */
export async function ensureGeo(ids: number[], budgetMs = 60_000) {
  if (!ids.length) return 0;
  const until = Date.now() + budgetMs;
  const rows = await prisma.shipment.findMany({
    where: { id: { in: ids }, destLat: null },
    select: { id: true, destStreet: true, destNumber: true, destColony: true, destZip: true, borough: true, geoKey: true },
  });
  let done = 0;
  for (const r of rows) {
    const addr = { street: r.destStreet, number: r.destNumber, colony: r.destColony, zip: r.destZip, borough: r.borough };
    const key = geoKeyOf(addr);
    if (r.geoKey === key) continue;
    if (Date.now() > until) break;
    try {
      const g = await geocodeAddress(addr);
      await prisma.shipment.update({
        where: { id: r.id },
        data: g ? { geoLat: g.lat, geoLng: g.lng, geoLevel: g.level, geoKey: key } : { geoLat: null, geoLng: null, geoLevel: "ninguna", geoKey: key },
      });
      done++;
    } catch {
      // Sin red o Nominatim no respondió: se intenta otra vez la próxima vez
    }
  }
  return done;
}
