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
  return lang === "en" ? docTextEn(text, field) : lang === "zh" ? docTextZh(text, field) : text;
}

// ───────── Chino simplificado ─────────

const tZh = translator("zh");
const ZH_MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const zhMonth = (m: string) => ZH_MONTHS[m.toLowerCase()] ?? m;
const hasCjk = (s: string) => /[㐀-鿿]/.test(s);

/** Busca en el diccionario chino con la misma tolerancia que lookup(); solo acepta resultados en chino. */
function lookupZh(text: string) {
  const s = text.trim().replace(/\s+/g, " ");
  const bare = s.replace(/\.$/, "");
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
  for (const k of [text, s, bare, `${bare}.`, cap(bare), `${cap(bare)}.`]) {
    const v = tZh(k);
    if (v !== k && hasCjk(v)) return v;
  }
  return null;
}

/** Frases habituales del campo "Almacenamiento" en chino. */
function storageZh(text: string) {
  const s = text.trim();
  if (/^no se (?:cobra|factura)/i.test(s)) return "本期不收取仓储费。";
  if (/^sin (?:cargo|costo|cobro)/i.test(s)) return "本期无仓储费用。";
  if (/^(?:no aplica|n\/a)\.?$/i.test(s)) return "不适用。";
  if (/^incluid[oa]/i.test(s)) return /servicio/i.test(s) ? "已包含在服务中。" : /tarifa/i.test(s) ? "已包含在费率中。" : "已包含。";
  return s
    .replace(/\b(?:almacenamiento|almacenaje)\b/gi, "仓储")
    .replace(/\btarimas?\b/gi, "托盘")
    .replace(/\bposici(?:ones|ón)\b/gi, "库位")
    .replace(/\bubicaci(?:ones|ón)\b/gi, "货位")
    .replace(/\b(?:por|al) mes\b/gi, "/月")
    .replace(/\bpor semana\b/gi, "/周")
    .replace(/\bpor día\b/gi, "/天")
    .replace(/\bmensual(?:es)?\b/gi, "每月")
    .replace(/\bdías\b/gi, "天")
    .replace(/\bde\b/gi, "")
    .replace(/\s{2,}/g, " ");
}

/** Texto de documento en chino (mismo criterio que docTextEn: lo que no se reconoce se deja como se capturó). */
export function docTextZh(text: string, field: DocField = "general") {
  if (!text?.trim()) return text;
  const direct = lookupZh(text);
  if (direct) return direct;
  if (field === "storage") return storageZh(text);
  return text
    .replace(/^Material de empaque: /, "包装材料：")
    .replace(/(\d+) al (\d+) de (\w+) de (\d{4})/g, (_, a, b, m, y) => `${y}年${zhMonth(m)}月${a}日至${b}日`)
    .replace(/(\d+) de (\w+) al (\d+) de (\w+) de (\d{4})/g, (_, a, m1, b, m2, y) => `${y}年${zhMonth(m1)}月${a}日至${zhMonth(m2)}月${b}日`)
    .replace(/ — ciclo semanal/, "（每周周期）")
    .replace(/ — ciclo mensual/, "（每月周期）")
    .replace(/(\d+) paquetes en (\d+) día\(s\) operado\(s\)/, "$2 个作业日共 $1 件包裹")
    .replace(/Paquetes procesados del /, "已处理包裹：")
    .replace(/^Medidas (.+) cm$/, "尺寸 $1 厘米")
    .replace(/^Pago contra recepción de factura a (\d+) días naturales\.?$/, "收到发票后 $1 个自然日内付款。")
    .replace(/^Pago contra recepción de factura\.?$/, "收到发票后付款。");
}
