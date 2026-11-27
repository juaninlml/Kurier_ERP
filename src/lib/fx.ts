import { prisma } from "./db";

/*
 * Tipo de cambio de referencia CNY → MXN (MXN por 1 CNY) que se sugiere en el formulario de facturas.
 * Fuente pública y gratuita, sin clave ni datos del usuario: Frankfurter (tipos de referencia del Banco
 * Central Europeo, se publican en días hábiles).
 *
 * Se guarda en la configuración de la empresa y se renueva cada sábado a las 7:00 a. m. (zona horaria de
 * la empresa): lo hace el cron de Vercel (vercel.json → /api/cron/tipo-cambio). Si el cron no corrió,
 * se renueva solo la primera vez que se abre una factura después de esa hora.
 */

const SOURCE = "https://api.frankfurter.dev/v1/latest?base=CNY&symbols=MXN";
const REFRESH_DAY = 6; // sábado (0 = domingo)
const REFRESH_HOUR = 7;

/** Consulta el tipo de cambio en la fuente (sin caché). */
async function fetchCnyRate(): Promise<{ rate: number; date: string } | null> {
  try {
    const res = await fetch(SOURCE, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { date?: string; rates?: { MXN?: number } };
    const rate = Number(data.rates?.MXN);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return { rate: Math.round(rate * 10000) / 10000, date: String(data.date ?? "") };
  } catch {
    return null;
  }
}

/** Último sábado a las 7:00 a. m. (hora local de `tz`) que ya pasó, como instante UTC. */
export function lastScheduledRefresh(tz: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  // Hora local "de pared" expresada como si fuera UTC, y su diferencia con el instante real
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = wall - now.getTime();
  const local = new Date(wall);
  const back = (local.getUTCDay() - REFRESH_DAY + 7) % 7;
  let target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - back, REFRESH_HOUR);
  if (target > wall) target -= 7 * 86_400_000;
  return new Date(target - offset);
}

/** Consulta la fuente y guarda el tipo de cambio en la configuración. Regresa null si la fuente no responde. */
export async function refreshCnyRate() {
  const fx = await fetchCnyRate();
  if (!fx) return null;
  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: { cnyRate: fx.rate, cnyRateDate: fx.date, cnyRateAt: new Date() },
    create: { id: 1, cnyRate: fx.rate, cnyRateDate: fx.date, cnyRateAt: new Date() },
  });
  return fx;
}

/** Tipo de cambio de la semana para sugerirlo en las facturas; null si nunca se pudo consultar (captura manual). */
export async function suggestedCnyRate(): Promise<{ rate: number; date: string } | null> {
  const s = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { cnyRate: true, cnyRateDate: true, cnyRateAt: true, timezone: true } });
  const stored = s && s.cnyRate > 0 ? { rate: s.cnyRate, date: s.cnyRateDate } : null;
  const due = !s?.cnyRateAt || s.cnyRateAt < lastScheduledRefresh(s.timezone || "America/Mexico_City");
  if (!due && stored) return stored;
  // Respaldo por si el cron del sábado no corrió: se renueva ahora (si la fuente falla, queda el guardado)
  return (await refreshCnyRate()) ?? stored;
}
