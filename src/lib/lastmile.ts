import { randomInt } from "node:crypto";
import { prisma } from "./db";
import { addDaysStr, localParts } from "./attendance";
import { BOROUGH_LIST, ZIP_RE, boroughOfZip, zoneOf } from "./lastmile-zones";
export * from "./lastmile-zones";

/*
 * Última milla CDMX: la zona sale de la alcaldía del CP destino y el precio por parada, del tarifario
 * (servicios UM-02 a UM-07, editables en Tarifario) o de la tarifa negociada del cliente.
 *   Zona 1: Benito Juárez, Cuauhtémoc, Iztacalco, Venustiano Carranza, Coyoacán y Miguel Hidalgo.
 *   Zona 2: resto de las alcaldías de la Ciudad de México.
 * Tarifa preferencial según el promedio de entregas diarias del cliente en el mes (10–19 y 20 o más).
 */

const norm = (x: string) =>
  x
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();

/** Promedio de entregas diarias (lunes a sábado) del cliente en el mes en curso. */
async function clientDailyAverage(clientId: number, tz: string) {
  const today = localParts(new Date(), tz).date;
  const monthStart = `${today.slice(0, 7)}-01`;
  let workdays = 0;
  for (let d = monthStart; d <= today; d = addDaysStr(d, 1)) if (new Date(`${d}T12:00:00Z`).getUTCDay() !== 0) workdays++;
  const count = await prisma.shipment.count({
    where: { clientId, status: { not: "CANCELADA" }, createdAt: { gte: new Date(`${monthStart}T06:00:00Z`) } },
  });
  return workdays ? Math.round((count / workdays) * 10) / 10 : 0;
}

export type LastMileQuote =
  | { ok: false; error: string }
  | {
      ok: true;
      borough: string;
      zone: number;
      price: number;
      label: string;
      /** Tarifas de la zona para mostrar (base y por volumen). */
      tiers: { label: string; price: number; active: boolean }[];
      dailyAverage: number | null;
      clientRate: boolean;
    };

/** Cotiza una entrega de última milla a un CP (opcionalmente con la alcaldía elegida y el cliente que paga). */
export async function quoteLastMile(input: { zip: string; borough?: string; clientId?: number | null }): Promise<LastMileQuote> {
  const zip = input.zip.trim();
  if (!ZIP_RE.test(zip)) return { ok: false, error: "El CP de destino debe tener 5 dígitos." };
  const borough = input.borough && BOROUGH_LIST.includes(input.borough) ? input.borough : boroughOfZip(zip);
  const zone = zoneOf(borough);
  if (!zone) return { ok: false, error: "Fuera de cobertura: la última milla solo entrega dentro de la Ciudad de México." };

  const [services, cfg, client] = await Promise.all([
    prisma.service.findMany({ where: { name: { startsWith: `Entrega Zona ${zone}` }, active: true }, select: { code: true, name: true, unitPrice: true, active: true } }),
    prisma.companySettings.findUnique({ where: { id: 1 }, select: { timezone: true } }),
    input.clientId ? prisma.client.findUnique({ where: { id: input.clientId }, include: { rates: { where: { active: true } } } }) : null,
  ]);
  const base = services.find((s) => norm(s.name) === norm(`Entrega Zona ${zone}`));
  const cheaper = (x?: { unitPrice: number }) => (x && base && x.unitPrice < base.unitPrice ? x : undefined);
  const mid = cheaper(services.find((s) => /10 a 19/.test(s.name)));
  const top = cheaper(services.find((s) => /20 o m/.test(s.name)));
  const basePrice = base?.unitPrice ?? (zone === 1 ? 70 : 110);

  // Tarifa negociada del cliente con el mismo nombre ("Entrega Zona 1"): manda sobre el tarifario
  const own = client?.rates.find((r) => norm(r.name) === norm(`Entrega Zona ${zone}`));
  if (own) {
    return {
      ok: true,
      borough,
      zone,
      price: own.unitPrice,
      label: `Tarifa del cliente · Zona ${zone}`,
      tiers: [{ label: `Tarifa de ${client!.name}`, price: own.unitPrice, active: true }],
      dailyAverage: null,
      clientRate: true,
    };
  }

  const avg = client ? await clientDailyAverage(client.id, cfg?.timezone || "America/Mexico_City") : null;
  const level = avg === null ? 0 : avg >= 20 && top ? 2 : avg >= 10 && mid ? 1 : 0;
  const tiers = [
    { label: "Tarifa base", price: basePrice, active: level === 0 },
    ...(mid ? [{ label: "10 a 19 entregas diarias", price: mid.unitPrice, active: level === 1 }] : []),
    ...(top ? [{ label: "20 o más entregas diarias", price: top.unitPrice, active: level === 2 }] : []),
  ];
  const chosen = tiers.find((t) => t.active) ?? tiers[0];
  return { ok: true, borough, zone, price: chosen.price, label: `Entrega Zona ${zone}${level ? ` · ${chosen.label}` : ""}`, tiers, dailyAverage: avg, clientRate: false };
}

// ───────── Número de guía ─────────

const ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679"; // sin letras/números que se confunden (0/O, 1/I, 5/S, 8/B, 2/Z)
const chunk = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
/** Dígito verificador simple (suma ponderada) para la referencia interna. */
const check = (s: string) => ALPHABET[[...s].reduce((a, c, i) => a + (ALPHABET.indexOf(c) + 1) * (i + 1), 0) % ALPHABET.length];

/** Guía nueva única: LM-XXXX-XXXX y su referencia KK-XXXX-XXXX-D. */
export async function newTracking() {
  for (let i = 0; i < 10; i++) {
    const code = `${chunk(4)}-${chunk(4)}`;
    const tracking = `LM-${code}`;
    if (!(await prisma.shipment.findUnique({ where: { tracking }, select: { id: true } }))) return { tracking, reference: `KK-${code}-${check(code.replace("-", ""))}` };
  }
  throw new Error("No se pudo generar el número de guía. Intenta de nuevo.");
}

