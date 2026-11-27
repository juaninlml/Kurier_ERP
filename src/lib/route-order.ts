import { boroughOfZip } from "./lastmile-zones";

/*
 * Orden de entrega de las guías de una carga (sin dependencias de servidor; se puede probar solo).
 *
 * Cada parada se ubica con el mejor punto disponible:
 *   1. El link de ubicación del cliente (exacto).
 *   2. La ubicación aproximada de la dirección (OpenStreetMap, calle o CP; ver src/lib/geocode.ts).
 *   3. El centro de su alcaldía, si no se encontró nada.
 * Con esos puntos se arma un circuito que sale de la base (Castilla 262, Col. Álamos; ver DEPOT) y regresa:
 * vecino más cercano y después se mejora con 2-opt (quitar cruces) y or-opt (mover paradas sueltas al
 * hueco donde menos desvían). Las paradas que caen en el mismo punto van juntas, por CP, colonia, calle y número.
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

/**
 * Or-opt: toma tramos de 1 a 3 paradas y los mueve (al derecho o al revés) al lugar del circuito donde
 * menos desvían. Corrige las paradas que el vecino más cercano deja "olvidadas" y obligan a regresar.
 */
function orOpt<T>(route: T[], at: (t: T) => Point, start: Point) {
  let r = [...route];
  let improved = true;
  for (let pass = 0; improved && pass < 100; pass++) {
    improved = false;
    for (let len = 1; len <= 3 && !improved; len++) {
      for (let i = 0; i + len <= r.length && !improved; i++) {
        const pt = (k: number) => (k < 0 || k >= r.length ? start : at(r[k]));
        const first = pt(i);
        const last = pt(i + len - 1);
        // Lo que se ahorra al quitar el tramo y unir sus vecinos
        const gain = km(pt(i - 1), first) + km(last, pt(i + len)) - km(pt(i - 1), pt(i + len));
        const rest = [...r.slice(0, i), ...r.slice(i + len)];
        const rp = (k: number) => (k < 0 || k >= rest.length ? start : at(rest[k]));
        for (let j = 0; j <= rest.length; j++) {
          if (j === i) continue;
          const a = rp(j - 1);
          const b = rp(j);
          const ab = km(a, b);
          const fwd = km(a, first) + km(last, b) - ab;
          const rev = km(a, last) + km(first, b) - ab;
          if (Math.min(fwd, rev) + 1e-9 < gain) {
            const seg = r.slice(i, i + len);
            r = [...rest.slice(0, j), ...(rev < fwd ? seg.reverse() : seg), ...rest.slice(j)];
            improved = true;
            break;
          }
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

/** Recorrido: vecino más cercano, luego 2-opt y or-opt hasta que ya no se acorte. */
function plan<T>(items: T[], at: (t: T) => Point, start: Point) {
  let r = nearestNeighbor(items, at, start);
  let km0 = tourKm(r, at, start);
  for (let round = 0; round < 10; round++) {
    r = orOpt(twoOpt(r, at, start), at, start);
    const km1 = tourKm(r, at, start);
    if (km1 + 1e-9 >= km0) break;
    km0 = km1;
  }
  return nearestFirst(r, at, start);
}

/** Kilómetros aproximados en línea recta de un orden de paradas (base → paradas → base). */
export function routeKm(stops: Stop[], order: number[], start: Point = DEPOT) {
  const byId = new Map(stops.map((s) => [s.id, s]));
  return tourKm(order.map((id) => byId.get(id)!), pointOf, start);
}

export function orderStops(stops: Stop[], start: Point = DEPOT): number[] {
  if (stops.length <= 1) return stops.map((s) => s.id);
  // Paradas en el mismo punto (mismo edificio, o mismo centro de CP/alcaldía) se visitan juntas
  const groups = new Map<string, Stop[]>();
  for (const s of stops) {
    const p = pointOf(s);
    const k = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const tour = plan([...groups.values()], (g) => pointOf(g[0]), start);
  return tour.flatMap((g) => g.sort(withinBorough).map((s) => s.id));
}
