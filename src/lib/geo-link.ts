/*
 * Coordenadas a partir del link de ubicación que manda el cliente (Google Maps o WhatsApp → "Abrir en Maps").
 * Sin dependencias de servidor: la usa el formulario para avisar y el servidor para guardar.
 *
 * Formatos que entiende (lat, lng con punto decimal):
 *   19.4326, -99.1332                              coordenadas sueltas
 *   …/maps/place/…/@19.4326,-99.1332,17z            vista del mapa
 *   …!3d19.4326!4d-99.1332                          el pin exacto de un lugar (gana sobre "@")
 *   …?q=19.4326,-99.1332  · ?query= · ?ll= · ?destination= · ?daddr= · ?center=
 * Los links cortos (maps.app.goo.gl, goo.gl/maps) se abren en el servidor para ver a dónde llevan.
 */
export type LatLng = { lat: number; lng: number };

const NUM = "(-?\\d{1,3}\\.\\d+)";
const valid = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function coordsFromText(raw: string): LatLng | null {
  let text = raw.trim();
  try {
    text = decodeURIComponent(text);
  } catch {}
  const tries = [
    new RegExp(`!3d${NUM}!4d${NUM}`), // pin del lugar
    new RegExp(`[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?${NUM}\\s*,\\s*${NUM}`),
    new RegExp(`@${NUM},${NUM}`),
    new RegExp(`/maps/search/${NUM},\\s*\\+?${NUM}`),
    new RegExp(`^${NUM}\\s*,\\s*${NUM}$`), // "19.43, -99.13"
  ];
  for (const re of tries) {
    const m = text.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (valid(lat, lng)) return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
    }
  }
  return null;
}

/** ¿Es un link corto de Google Maps (hay que abrirlo para saber las coordenadas)? */
export const isShortMapsLink = (text: string) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.google\.com\/\?cid=)/i.test(text.trim());

/** ¿Parece un link o texto de ubicación? (para el formulario). */
export const looksLikeLocation = (text: string) => /^https?:\/\//i.test(text.trim()) || coordsFromText(text) !== null;

/** Recuadro de la Ciudad de México (con un margen pequeño). */
export const inCdmx = ({ lat, lng }: LatLng) => lat >= 19.04 && lat <= 19.6 && lng >= -99.37 && lng <= -98.93;

/** Link para abrir el punto exacto en Google Maps. */
export const mapsPointUrl = ({ lat, lng }: LatLng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
