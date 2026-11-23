import { translator, type Lang } from "./index";

/**
 * Traducción al inglés de los textos que se guardan en las facturas (periodo, volumen, almacenamiento,
 * condiciones, conceptos). Se guardan siempre en español; al mostrarlos en inglés se traducen los textos
 * que genera el ERP y las frases comunes. Lo que no se reconoce se deja como se capturó.
 */

const EN_MONTHS: Record<string, string> = {
  enero: "January", febrero: "February", marzo: "March", abril: "April", mayo: "May", junio: "June",
  julio: "July", agosto: "August", septiembre: "September", octubre: "October", noviembre: "November", diciembre: "December",
};
const month = (m: string) => EN_MONTHS[m.toLowerCase()] ?? m;

const tEn = translator("en");

/** Busca en el diccionario tolerando espacios, punto final y mayúscula inicial distintos. */
function lookup(text: string) {
  const s = text.trim().replace(/\s+/g, " ");
  const bare = s.replace(/\.$/, "");
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
  for (const k of [text, s, bare, `${bare}.`, cap(bare), `${cap(bare)}.`]) {
    const v = tEn(k);
    if (v !== k) return v;
  }
  return null;
}

/** Frases habituales del campo "Almacenamiento". */
function storageEn(text: string) {
  const s = text.trim();
  const periodo = String.raw`(?:en |durante )?(?:este|el|esta) (?:periodo|período|mes|semana|ciclo|corte)`;
  const que = String.raw`(?:el |la )?(?:almacenamiento|almacenaje)?`;
  if (new RegExp(String.raw`^no se (?:cobra|factura)n?\s*${que}\s*(?:${periodo})?\.?$`, "i").test(s)) return "Not charged in this period.";
  if (new RegExp(String.raw`^sin (?:cargo|costo|cobro)(?: de)?\s*${que}\s*(?:${periodo})?\.?$`, "i").test(s)) return "No charge in this period.";
  if (/^(?:no aplica|n\/a)\.?$/i.test(s)) return "Not applicable.";
  if (/^incluid[oa](?: en (?:la|el) (?:tarifa|servicio))?\.?$/i.test(s)) return /servicio/i.test(s) ? "Included in the service." : /tarifa/i.test(s) ? "Included in the rate." : "Included.";
  // Descripciones libres ("12 tarimas por mes", "Almacenaje de 3 posiciones"): se traducen las palabras clave.
  return s
    .replace(/\b(almacenamiento|almacenaje)\b/gi, "storage")
    .replace(/\btarimas\b/gi, "pallets")
    .replace(/\btarima\b/gi, "pallet")
    .replace(/\bposiciones\b/gi, "positions")
    .replace(/\bposición\b/gi, "position")
    .replace(/\bubicaciones\b/gi, "locations")
    .replace(/\bubicación\b/gi, "location")
    .replace(/\b(?:por|al) mes\b/gi, "per month")
    .replace(/\bpor semana\b/gi, "per week")
    .replace(/\bpor día\b/gi, "per day")
    .replace(/\bmensual(?:es)?\b/gi, "monthly")
    .replace(/\bdías\b/gi, "days")
    .replace(/\bde\b/gi, "of")
    .replace(/^storage/, "Storage");
}

export type DocField = "storage" | "general";

/** Texto de documento en inglés (ver arriba). */
export function docTextEn(text: string, field: DocField = "general") {
  if (!text?.trim()) return text;
  const direct = lookup(text);
  if (direct) return direct;
  if (field === "storage") return storageEn(text);
  return text
    .replace(/^Material de empaque: /, "Packing material: ")
    .replace(/(\d+) al (\d+) de (\w+) de (\d{4})/g, (_, a, b, m, y) => `${month(m)} ${a}–${b}, ${y}`)
    .replace(/(\d+) de (\w+) al (\d+) de (\w+) de (\d{4})/g, (_, a, m1, b, m2, y) => `${month(m1)} ${a} – ${month(m2)} ${b}, ${y}`)
    .replace(/ — ciclo semanal/, " — weekly cycle")
    .replace(/ — ciclo mensual/, " — monthly cycle")
    .replace(/(\d+) paquetes en (\d+) día\(s\) operado\(s\)/, "$1 packages over $2 operating day(s)")
    .replace(/Paquetes procesados del /, "Packages processed ")
    .replace(/^Medidas (.+) cm$/, "Size $1 cm")
    .replace(/^Pago contra recepción de factura a (\d+) días naturales\.?$/, "Payment due within $1 calendar days of receipt of invoice.")
    .replace(/^Pago contra recepción de factura\.?$/, "Payment due upon receipt of invoice.");
}

/** Texto de documento en el idioma pedido (en español se deja tal cual). */
export function docText(text: string, lang: Lang, field: DocField = "general") {
  return lang === "en" ? docTextEn(text, field) : text;
}
