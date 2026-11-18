import { getDocumentProxy } from "unpdf";
import { wmsStatementSchema, type WmsLine, type WmsStatement } from "./types";

type Item = { x: number; y: number; end: number; str: string };
type Row = { page: number; y: number; cells: Item[] };

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const money = (t: string) => Number(t.replace(/[^0-9.-]/g, "")) || 0;
const isMoney = (t: string) => /^-?\$\s?[\d,]+(\.\d+)?$/.test(t.trim());
const pad = (n: number) => String(n).padStart(2, "0");

/** Agrupa los textos del PDF en renglones (misma altura) y une fragmentos pegados ("$267" + ".44"). */
async function readRows(data: Uint8Array): Promise<Row[]> {
  const pdf = await getDocumentProxy(data);
  const rows: Row[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const raw of content.items as { str?: string; transform?: number[]; width?: number }[]) {
      if (!raw.str?.trim() || !raw.transform) continue;
      items.push({ x: raw.transform[4], y: raw.transform[5], end: raw.transform[4] + (raw.width ?? 0), str: raw.str });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const pageRows: Row[] = [];
    for (const it of items) {
      const row = pageRows.find((r) => Math.abs(r.y - it.y) <= 2.5);
      if (row) row.cells.push(it);
      else pageRows.push({ page: p, y: it.y, cells: [it] });
    }
    for (const r of pageRows) {
      r.cells.sort((a, b) => a.x - b.x);
      const merged: Item[] = [];
      for (const c of r.cells) {
        const prev = merged[merged.length - 1];
        if (prev && c.x - prev.end < 1.2 && !(isMoney(prev.str) && isMoney(c.str))) {
          prev.str += c.str;
          prev.end = c.end;
        } else merged.push({ ...c });
      }
      r.cells = merged;
    }
    pageRows.sort((a, b) => b.y - a.y);
    rows.push(...pageRows);
  }
  return rows;
}

/** "19 oct – 25 oct 2026" o "26 oct – 1 nov 2026" → fechas ISO. */
export function parsePeriod(label: string): { from?: string; to?: string } {
  const m = label.match(/(\d{1,2})\s+([a-zé.]+)\s*(\d{4})?\s*[–-]\s*(\d{1,2})\s+([a-zé.]+)\s+(\d{4})/i);
  if (!m) return {};
  const m1 = MONTHS[m[2].replace(".", "").toLowerCase()];
  const m2 = MONTHS[m[5].replace(".", "").toLowerCase()];
  if (!m1 || !m2) return {};
  const y2 = Number(m[6]);
  const y1 = m[3] ? Number(m[3]) : m1 > m2 ? y2 - 1 : y2;
  return { from: `${y1}-${pad(m1)}-${pad(Number(m[1]))}`, to: `${y2}-${pad(m2)}-${pad(Number(m[4]))}` };
}

/** "2 de noviembre de 2026" → "2026-11-02". */
function parseLongDate(t: string) {
  const m = t.match(/(\d{1,2})\s+de\s+([a-zé]+)\s+de\s+(\d{4})/i);
  const mo = m && MONTHS[m[2].toLowerCase()];
  return m && mo ? `${m[3]}-${pad(mo)}-${pad(Number(m[1]))}` : undefined;
}

const HEADER_LABELS = ["FECHA", "CONCEPTO", "DESCRIPCIÓN", "CANT.", "UNIDAD", "P.U.", "IMPORTE"];

/**
 * Lee el PDF de "Invoice" que genera el WMS de Kurier (secciones SISTEMA / FLETES / MANIOBRAS…,
 * columnas Fecha · Concepto · Descripción · Cant. · Unidad · P.U. · Importe).
 */
export async function parseWmsPdf(data: Uint8Array): Promise<WmsStatement> {
  const rows = await readRows(data);
  const text = (r: Row) => r.cells.map((c) => c.str).join(" ");

  // Encabezado: etiqueta en un renglón y su valor justo debajo, en la misma columna.
  const meta: Record<string, string> = {};
  rows.forEach((r, i) => {
    for (const c of r.cells) {
      const key = c.str.trim().toUpperCase();
      if (!["CLIENTE", "PERIODO", "EMITIDO", "MONEDA", "CERRADO"].includes(key) || meta[key]) continue;
      const next = rows[i + 1];
      const val = next?.cells.find((v) => Math.abs(v.x - c.x) < 4);
      if (val) meta[key] = val.str.trim();
    }
  });
  const folio = rows.map(text).join(" ").match(/\b[A-Z]{2,5}-\d{4}-\d{2}-\d{2}-\d{3,}\b/)?.[0] ?? "";

  // Columnas, tomadas del primer renglón de encabezados de tabla.
  const head = rows.find((r) => HEADER_LABELS.every((h) => r.cells.some((c) => c.str.trim().toUpperCase() === h)));
  const colX = (h: string, def: number) => head?.cells.find((c) => c.str.trim().toUpperCase() === h)?.x ?? def;
  const X = {
    concept: colX("CONCEPTO", 100),
    desc: colX("DESCRIPCIÓN", 216),
    qty: colX("CANT.", 399),
    unit: colX("UNIDAD", 428),
  };
  const unitEnd = X.unit + 40;

  const lines: WmsLine[] = [];
  let section = "";
  let last: WmsLine | null = null;
  let lastY = 0;
  let subtotal = 0,
    tax = 0,
    total = 0;

  for (const r of rows) {
    const first = r.cells[0]?.str.trim() ?? "";
    const upper = first.toUpperCase();
    if (r === head || (HEADER_LABELS.includes(upper) && r.cells.length >= 5)) continue;

    // Totales
    if (/^subtotal$/i.test(first)) { subtotal = money(r.cells.at(-1)!.str); last = null; continue; }
    if (/^iva/i.test(first)) { tax = money(r.cells.at(-1)!.str); last = null; continue; }
    if (/^total/i.test(first)) { total = money(r.cells.at(-1)!.str); last = null; continue; }

    // Título de sección: "FLETES ........ $369.84"
    if (/^[A-ZÁÉÍÓÚÑ ]{3,}$/.test(first) && r.cells.length <= 2 && (r.cells.length === 1 || isMoney(r.cells[1].str)) && !["CLIENTE", "PERIODO"].includes(upper)) {
      section = first;
      last = null;
      continue;
    }

    if (DATE.test(first)) {
      const inCol = (from: number, to: number) =>
        r.cells
          .filter((c) => c.x >= from - 2 && c.x < to - 2)
          .map((c) => c.str.trim())
          .join(" ");
      const moneys = r.cells.filter((c) => isMoney(c.str) && c.x >= unitEnd - 40);
      const qtyCell = r.cells.find((c) => c.x >= X.qty - 25 && c.x < X.unit - 1 && /^[\d.,]+$/.test(c.str.trim()));
      const description = inCol(X.desc, X.qty - 25);
      const line: WmsLine = {
        date: first,
        section,
        concept: inCol(X.concept, X.desc),
        description,
        quantity: qtyCell ? Number(qtyCell.str.replace(/,/g, "")) : 1,
        unit: r.cells.filter((c) => c.x >= X.unit - 2 && c.x < unitEnd && !isMoney(c.str)).map((c) => c.str.trim()).join(" "),
        unitPrice: moneys.length >= 2 ? money(moneys[moneys.length - 2].str) : 0,
        amount: moneys.length ? money(moneys[moneys.length - 1].str) : 0,
      };
      const ref = description.match(/\b[A-Z]{1,3}-\d{2,}\b/)?.[0];
      if (ref) line.orderRef = ref;
      const carrier = description.split("·")[1]?.trim();
      if (carrier) line.carrier = carrier;
      if (!line.unitPrice && line.quantity) line.unitPrice = Math.round((line.amount / line.quantity) * 100) / 100;
      lines.push(line);
      last = line;
      lastY = r.y;
      continue;
    }

    // Continuación de un texto que no cupo en el renglón ("Picking pieza/bulto" + "adicional")
    if (last && lastY - r.y < 16 && r.cells.every((c) => !isMoney(c.str))) {
      for (const c of r.cells) {
        if (c.x >= X.concept - 2 && c.x < X.desc - 2) last.concept = `${last.concept} ${c.str.trim()}`;
        else if (c.x >= X.desc - 2 && c.x < X.qty - 25) last.description = `${last.description} ${c.str.trim()}`;
      }
    }
  }

  const period = parsePeriod(meta.PERIODO ?? "");
  const statement = {
    folio,
    clientName: meta.CLIENTE ?? "",
    periodLabel: meta.PERIODO ?? "",
    periodFrom: period.from,
    periodTo: period.to,
    issuedAt: (meta.CERRADO && DATE.test(meta.CERRADO) ? meta.CERRADO : undefined) ?? parseLongDate(meta.EMITIDO ?? ""),
    currency: meta.MONEDA || "MXN",
    lines,
    subtotal,
    tax,
    total,
  };
  const parsed = wmsStatementSchema.safeParse(statement);
  if (!parsed.success) {
    throw new Error(
      !folio
        ? "El PDF no parece un estado de cobro del WMS (no se encontró el folio COB-…)."
        : !statement.clientName
          ? "No se encontró el nombre del cliente en el PDF."
          : (parsed.error.issues[0]?.message ?? "No se pudo leer el PDF."),
    );
  }
  return parsed.data;
}
