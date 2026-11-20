import { requestLocale } from "./request-lang";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
export const formatMoney = (n: number) => mxn.format(n || 0);

const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
export const formatNumber = (n: number) => num.format(n || 0);

/*
 * Fechas. En pantalla salen en el idioma del usuario (requestLocale). Los PDFs y los textos que se guardan
 * (movimientos de contabilidad, conceptos) usan las versiones *Es: siempre en español.
 */
export const formatDate = (d: Date | string, locale = requestLocale()) =>
  new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
export const formatDateEs = (d: Date | string) => formatDate(d, "es-MX");

/** 22/08/2026 */
export const formatDateNum = (d: Date | string, locale = requestLocale()) =>
  new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
export const formatDateNumEs = (d: Date | string) => formatDateNum(d, "es-MX");

/** 10 de noviembre de 2026 */
export const formatDateLong = (d: Date | string, locale = requestLocale()) =>
  new Date(d).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const formatDateLongEs = (d: Date | string) => formatDateLong(d, "es-MX");

/** yyyy-mm-dd para inputs type=date (en UTC para evitar corrimientos de zona). */
export const toInputDate = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Fecha de un input yyyy-mm-dd → Date a mediodía UTC (estable en cualquier zona horaria). */
export const fromInputDate = (s: string) => new Date(`${s}T12:00:00.000Z`);

export const addDays = (d: Date, days: number) => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
};

// ---- Importe con letra (formato usual en México) ----
const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const ESPECIALES = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
const VEINTIS = ["VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function under100(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return ESPECIALES[n - 10];
  if (n < 30) return VEINTIS[n - 20];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return DECENAS[d] + (u ? ` Y ${UNIDADES[u]}` : "");
}

function under1000(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  return [CENTENAS[c], under100(r)].filter(Boolean).join(" ");
}

function intToWords(n: number): string {
  if (n === 0) return "CERO";
  const parts: string[] = [];
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  if (millones) parts.push(millones === 1 ? "UN MILLÓN" : `${intToWords(millones).replace(/UNO$/, "UN")} MILLONES`);
  if (miles) parts.push(miles === 1 ? "MIL" : `${under1000(miles).replace(/UNO$/, "UN")} MIL`);
  if (resto) parts.push(under1000(resto));
  return parts.join(" ");
}

export function amountInWords(amount: number): string {
  const total = round2(Math.abs(amount));
  const pesos = Math.floor(total);
  const centavos = Math.round((total - pesos) * 100);
  const words = intToWords(pesos).replace(/UNO$/, "UN");
  const de = pesos > 0 && pesos % 1_000_000 === 0 ? " DE" : "";
  return `${words}${de} ${pesos === 1 ? "PESO" : "PESOS"} ${String(centavos).padStart(2, "0")}/100 M.N.`;
}
