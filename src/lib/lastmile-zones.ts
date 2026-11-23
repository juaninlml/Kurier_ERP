/** Zonas de última milla CDMX (sin dependencias de servidor: se usa también en el formulario). */
/** Alcaldías de la CDMX por los dos primeros dígitos del CP (01 a 16). */
export const BOROUGHS: Record<string, string> = {
  "01": "Álvaro Obregón",
  "02": "Azcapotzalco",
  "03": "Benito Juárez",
  "04": "Coyoacán",
  "05": "Cuajimalpa",
  "06": "Cuauhtémoc",
  "07": "Gustavo A. Madero",
  "08": "Iztacalco",
  "09": "Iztapalapa",
  "10": "La Magdalena Contreras",
  "11": "Miguel Hidalgo",
  "12": "Milpa Alta",
  "13": "Tláhuac",
  "14": "Tlalpan",
  "15": "Venustiano Carranza",
  "16": "Xochimilco",
};
export const BOROUGH_LIST = Object.values(BOROUGHS);
const ZONE1 = new Set(["Benito Juárez", "Cuauhtémoc", "Iztacalco", "Venustiano Carranza", "Coyoacán", "Miguel Hidalgo"]);

export const ZIP_RE = /^\d{5}$/;
/** Alcaldía de un CP de la CDMX (vacío si el CP no es de la CDMX). */
export const boroughOfZip = (zip: string) => (ZIP_RE.test(zip) ? (BOROUGHS[zip.slice(0, 2)] ?? "") : "");
/** Zona de una alcaldía: 1 o 2 (0 = fuera de cobertura). */
export const zoneOf = (borough: string) => (!borough ? 0 : ZONE1.has(borough) ? 1 : BOROUGH_LIST.includes(borough) ? 2 : 0);

/** Peso volumétrico (kg) = largo × ancho × alto (cm) ÷ 5,000. */
export const volumetricKg = (l: number, w: number, h: number) => Math.round(((l * w * h) / 5000) * 100) / 100;


export const SHIPMENT_STATUS: Record<string, string> = {
  GENERADA: "Generada",
  EN_RUTA: "En ruta",
  ENTREGADA: "Entregada",
  CANCELADA: "Cancelada",
};
