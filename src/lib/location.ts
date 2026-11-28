import { coordsFromText, inCdmx, isShortMapsLink, type LatLng } from "./geo-link";
import { BOROUGH_CENTER, km } from "./route-order";

/*
 * Ubicación del destino a partir del link que manda el cliente (servidor: abre los links cortos).
 * Regresa las coordenadas o un error claro, y un aviso si el punto queda lejos de la alcaldía del CP
 * (pasa cuando el cliente mandó la ubicación desde otro lugar).
 */
export type LocationResult = { ok: true; lat: number; lng: number; warning: string } | { ok: false; error: string };

/**
 * Solo se abren direcciones de Google (google.com, google.com.mx, goo.gl, g.co…) y por HTTPS.
 * Se revisa el dominio ya interpretado (no el texto): "google.com.otro-sitio.com" o
 * "http://169.254.169.254/?google.com/maps" no pasan (evita que el servidor abra sitios internos).
 */
function googleUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || u.port) return null;
  const h = u.hostname.toLowerCase();
  const ok = h === "goo.gl" || h.endsWith(".goo.gl") || h === "g.co" || /^([a-z0-9-]+\.)*google\.(com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(h);
  if (!ok) return null;
  u.protocol = "https:";
  return u.toString();
}

/** Sigue las redirecciones de un link corto (máx. 5) y regresa la última dirección + el HTML si no trae coordenadas. */
async function expand(url: string): Promise<{ finalUrl: string; html: string }> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    const safeUrl = googleUrl(current);
    if (!safeUrl) return { finalUrl: current, html: "" };
    current = safeUrl;
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0 (compatible; KurierERP)" } });
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      current = new URL(next, current).toString();
      // Solo dominios de Google (el servidor no sigue links hacia otros sitios)
      if (!googleUrl(current)) return { finalUrl: current, html: "" };
      if (coordsFromText(current)) return { finalUrl: current, html: "" };
      continue;
    }
    // Sin más redirecciones: a veces las coordenadas solo vienen dentro de la página
    return { finalUrl: current, html: res.ok ? (await res.text()).slice(0, 400_000) : "" };
  }
  return { finalUrl: current, html: "" };
}

/** Coordenadas dentro del HTML de Maps (pin del lugar, vista o centro del mapa). */
function coordsInHtml(html: string): LatLng | null {
  if (!html) return null;
  const pin = html.match(/!3d-?\d{1,3}\.\d+!4d-?\d{1,3}\.\d+/);
  if (pin) return coordsFromText(pin[0]);
  const at = html.match(/@-?\d{1,3}\.\d+,-?\d{1,3}\.\d+/);
  if (at) return coordsFromText(at[0]);
  const center = html.match(/center=(-?\d{1,3}\.\d+)%2C(-?\d{1,3}\.\d+)/);
  return center ? coordsFromText(`${center[1]},${center[2]}`) : null;
}

export async function resolveLocation(raw: string, borough?: string): Promise<LocationResult> {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Pega el link de ubicación." };
  let point: LatLng | null = coordsFromText(text);
  if (!point && /^https?:\/\//i.test(text)) {
    if ((!isShortMapsLink(text) && !/google\.[a-z.]+\/maps|maps\.google\./i.test(text)) || !googleUrl(text)) {
      return { ok: false, error: "Ese link no es de Google Maps. Pide al cliente su ubicación de WhatsApp o un link de Maps." };
    }
    try {
      const { finalUrl, html } = await expand(text);
      point = coordsFromText(finalUrl) ?? coordsInHtml(html);
    } catch {
      return { ok: false, error: "No se pudo abrir el link. Revisa tu conexión o pega el link completo de Maps." };
    }
  }
  if (!point) return { ok: false, error: "El link no trae coordenadas. En Maps, abre el pin, toca «Compartir» y copia ese link." };
  if (!inCdmx(point)) return { ok: false, error: "La ubicación queda fuera de la Ciudad de México. Revísala con el cliente." };
  const center = borough ? BOROUGH_CENTER[borough] : undefined;
  const far = center ? km(point, center) : 0;
  return {
    ok: true,
    ...point,
    warning: far > 7 ? `El punto queda a ${far.toFixed(1)} km del centro de ${borough}: confirma con el cliente que sea su domicilio.` : "",
  };
}
