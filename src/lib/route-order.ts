import { boroughOfZip } from "./lastmile-zones";

/*
 * Orden de entrega de las guías de una carga (sin dependencias de servidor; se puede probar solo).
 *
 * Hoy las guías no tienen coordenadas, así que cada parada se ubica en el centro aproximado de su
 * alcaldía y el recorrido se arma así:
 *   1. Las alcaldías se visitan por cercanía (vecino más cercano), empezando por la del almacén.
 *   2. Dentro de cada alcaldía, por código postal, colonia, calle y número.
 * Cuando una parada traiga lat/lng (geocodificación con OpenStreetMap, pendiente), se usa la distancia
 * real entre paradas y el recorrido se mejora con 2-opt; el resto del sistema no cambia.
 */

export type Stop = {
  id: number;
  zip: string;
  borough: string;
  colony?: string;
  street?: string;
  number?: string;
  lat?: number | null;
  lng?: number | null;
};

type Point = { lat: number; lng: number };

/** Centro aproximado de cada alcaldía de la CDMX. */
export const BOROUGH_CENTER: Record<string, Point> = {
  "Álvaro Obregón": { lat: 19.358, lng: -99.203 },
  Azcapotzalco: { lat: 19.487, lng: -99.185 },
  "Benito Juárez": { lat: 19.372, lng: -99.158 },
  Coyoacán: { lat: 19.328, lng: -99.16 },
  Cuajimalpa: { lat: 19.357, lng: -99.299 },
  Cuauhtémoc: { lat: 19.433, lng: -99.15 },
  "Gustavo A. Madero": { lat: 19.491, lng: -99.112 },
  Iztacalco: { lat: 19.395, lng: -99.097 },
  Iztapalapa: { lat: 19.355, lng: -99.062 },
  "La Magdalena Contreras": { lat: 19.316, lng: -99.243 },
  "Miguel Hidalgo": { lat: 19.428, lng: -99.2 },
  "Milpa Alta": { lat: 19.192, lng: -99.023 },
  Tláhuac: { lat: 19.286, lng: -99.004 },
  Tlalpan: { lat: 19.29, lng: -99.167 },
  "Venustiano Carranza": { lat: 19.43, lng: -99.098 },
  Xochimilco: { lat: 19.257, lng: -99.104 },
};
const CDMX_CENTER: Point = { lat: 19.432, lng: -99.133 };

/** Distancia en km entre dos puntos (haversine). */
export function km(a: Point, b: Point) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const boroughOf = (s: Stop) => s.borough || boroughOfZip(s.zip);
const centerOf = (borough: string) => BOROUGH_CENTER[borough] ?? CDMX_CENTER;
const pointOf = (s: Stop): Point => (s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : centerOf(boroughOf(s)));

/** Número de la casa para comparar ("120-B" → 120). */
const houseNo = (n = "") => Number(n.match(/\d+/)?.[0] ?? 0);
const cmp = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
/** Orden dentro de una alcaldía: código postal, colonia, calle y número. */
const withinBorough = (a: Stop, b: Stop) =>
  cmp(a.zip, b.zip) || cmp(a.colony ?? "", b.colony ?? "") || cmp(a.street ?? "", b.street ?? "") || houseNo(a.number) - houseNo(b.number) || a.id - b.id;

/** Vecino más cercano: desde `start`, siempre al punto pendiente más próximo. */
function nearestNeighbor<T>(items: T[], at: (t: T) => Point, start: Point) {
  const left = [...items];
  const out: T[] = [];
  let here = start;
  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    left.forEach((t, i) => {
      const d = km(here, at(t));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const [next] = left.splice(best, 1);
    out.push(next);
    here = at(next);
  }
  return out;
}

/** Mejora un recorrido invirtiendo tramos mientras acorte la distancia total (2-opt). */
function twoOpt<T>(route: T[], at: (t: T) => Point, start: Point) {
  const r = [...route];
  const pt = (i: number) => (i < 0 ? start : at(r[i]));
  let improved = true;
  for (let pass = 0; improved && pass < 50; pass++) {
    improved = false;
    for (let i = 0; i < r.length - 1; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const before = km(pt(i - 1), pt(i)) + (j + 1 < r.length ? km(pt(j), pt(j + 1)) : 0);
        const after = km(pt(i - 1), pt(j)) + (j + 1 < r.length ? km(pt(i), pt(j + 1)) : 0);
        if (after + 1e-9 < before) {
          r.splice(i, j - i + 1, ...r.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return r;
}

/**
 * Orden de entrega. `startZip` es el CP del almacén (de donde sale el repartidor).
 * Regresa los ids en el orden en que hay que visitarlos.
 */
export function orderStops(stops: Stop[], startZip = ""): number[] {
  if (stops.length <= 1) return stops.map((s) => s.id);
  const start = centerOf(boroughOfZip(startZip));

  // Con coordenadas reales en todas las paradas: recorrido por distancia real
  if (stops.every((s) => s.lat != null && s.lng != null)) {
    return twoOpt(nearestNeighbor(stops, pointOf, start), pointOf, start).map((s) => s.id);
  }

  // Sin coordenadas: alcaldías por cercanía y, dentro de cada una, por CP, colonia y calle
  const groups = new Map<string, Stop[]>();
  for (const s of stops) {
    const b = boroughOf(s);
    groups.set(b, [...(groups.get(b) ?? []), s]);
  }
  const boroughs = twoOpt(nearestNeighbor([...groups.keys()], centerOf, start), centerOf, start);
  return boroughs.flatMap((b) => groups.get(b)!.sort(withinBorough).map((s) => s.id));
}
