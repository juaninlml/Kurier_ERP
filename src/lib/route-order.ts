import { boroughOfZip } from "./lastmile-zones";

/*
 * Orden de entrega de las guías de una carga (sin dependencias de servidor; se puede probar solo).
 *
 * Hoy las guías no tienen coordenadas, así que cada parada se ubica en el centro aproximado de su
 * alcaldía y el recorrido se arma así:
 *   1. Las alcaldías se visitan por cercanía (vecino más cercano), saliendo siempre de la base
 *      (Castilla 262, Col. Álamos, Benito Juárez, CP 03400; ver DEPOT).
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

/** Punto de partida de todas las rutas: la base de Kurier (ubicación aproximada de la colonia Álamos). */
export const DEPOT = {
  address: "Castilla 262, Col. Álamos, Benito Juárez, CP 03400",
  short: "Castilla 262, Álamos",
  zip: "03400",
  lat: 19.3958,
  lng: -99.1412,
} as const;

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

/**
 * Mejora el recorrido invirtiendo tramos mientras acorte la distancia total (2-opt). El recorrido es
 * un circuito: sale de `start` y regresa a él (el repartidor vuelve a la base al terminar).
 */
function twoOpt<T>(route: T[], at: (t: T) => Point, start: Point) {
  const r = [...route];
  // Índices -1 y r.length son la base (salida y regreso)
  const pt = (i: number) => (i < 0 || i >= r.length ? start : at(r[i]));
  let improved = true;
  for (let pass = 0; improved && pass < 50; pass++) {
    improved = false;
    for (let i = 0; i < r.length - 1; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const before = km(pt(i - 1), pt(i)) + km(pt(j), pt(j + 1));
        const after = km(pt(i - 1), pt(j)) + km(pt(i), pt(j + 1));
        if (after + 1e-9 < before) {
          r.splice(i, j - i + 1, ...r.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return r;
}

/** Un circuito se puede recorrer en los dos sentidos: se empieza por la parada más cercana a la base. */
function nearestFirst<T>(route: T[], at: (t: T) => Point, start: Point) {
  return route.length > 1 && km(start, at(route[route.length - 1])) < km(start, at(route[0])) ? [...route].reverse() : route;
}

/** Kilómetros del circuito completo: base → paradas → base. */
function tourKm<T>(route: T[], at: (t: T) => Point, start: Point) {
  let total = 0;
  let here = start;
  for (const t of route) {
    total += km(here, at(t));
    here = at(t);
  }
  return total + km(here, start);
}

/** Mejora mínima (5 %) para cambiar el orden intuitivo de "siempre a la más cercana". */
const MIN_GAIN = 0.05;

/**
 * Recorrido: primero "siempre a la parada más cercana" (lo que el repartidor espera); solo se cambia por
 * el circuito mejorado si ahorra al menos 5 % de kilómetros.
 */
function plan<T>(items: T[], at: (t: T) => Point, start: Point) {
  const greedy = nearestNeighbor(items, at, start);
  const better = nearestFirst(twoOpt(greedy, at, start), at, start);
  return tourKm(better, at, start) < tourKm(greedy, at, start) * (1 - MIN_GAIN) ? better : greedy;
}

/**
 * Orden de entrega desde `start` (por omisión, la base de Kurier: Castilla 262, Álamos).
 * Regresa los ids en el orden en que hay que visitarlos.
 */
export function orderStops(stops: Stop[], start: Point = DEPOT): number[] {
  if (stops.length <= 1) return stops.map((s) => s.id);

  // Con coordenadas reales en todas las paradas: recorrido por distancia real
  if (stops.every((s) => s.lat != null && s.lng != null)) {
    return plan(stops, pointOf, start).map((s) => s.id);
  }

  // Sin coordenadas: alcaldías por cercanía y, dentro de cada una, por CP, colonia y calle
  const groups = new Map<string, Stop[]>();
  for (const s of stops) {
    const b = boroughOf(s);
    groups.set(b, [...(groups.get(b) ?? []), s]);
  }
  const boroughs = plan([...groups.keys()], centerOf, start);
  return boroughs.flatMap((b) => groups.get(b)!.sort(withinBorough).map((s) => s.id));
}
