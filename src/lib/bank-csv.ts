/**
 * Lectura de estados de cuenta bancarios en CSV (BBVA, Banorte, Santander, Banamex, etc.).
 * Cada banco exporta columnas distintas, así que se reconocen por nombre:
 *   fecha · descripción/concepto · referencia · cargo + abono (o una sola columna de monto con signo).
 * Devuelve renglones con monto positivo = depósito y negativo = retiro.
 */
export type BankRow = { date: Date; description: string; reference: string; amount: number };

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8,
  sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

/** Texto del archivo: UTF-8, o Windows-1252 si no es UTF-8 válido (común en bancos). */
export function decodeBankFile(buf: Uint8Array) {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8;
}

function splitCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\s$]/g, "").replace(/MXN|MN/gi, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  // 1.234,56 (coma decimal) frente a 1,234.56 (punto decimal, lo normal en México)
  if (/,\d{1,2}$/.test(s) && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function parseBankDate(raw: string): Date | null {
  const s = norm(raw).replace(/\s+/g, " ");
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = s.match(/^(\d{1,2})[-/. ]([a-z]{3})[a-z]*\.?[-/. ](\d{2,4})/))) {
    d = Number(r[1]);
    m = MONTHS[r[2]] ?? 0;
    y = Number(r[3]);
  } else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  if (y < 100) y += 2000;
  if (!m || m > 12 || !d || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCDate() === d ? date : null;
}

const find = (headers: string[], re: RegExp, except?: RegExp) => headers.findIndex((h) => re.test(h) && !(except && except.test(h)));

export function parseBankCsv(text: string): { rows: BankRow[]; error?: undefined } | { error: string; rows?: undefined } {
  const firstLines = text.split(/\r?\n/).slice(0, 20).join("\n");
  const delim = [",", ";", "\t", "|"].map((d) => [d, firstLines.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const table = splitCsv(text, delim);
  const headerIdx = table.slice(0, 25).findIndex((r) => r.some((c) => /^fecha/.test(norm(c))));
  if (headerIdx < 0) return { error: "No se encontró el renglón de encabezados (con una columna \"Fecha\"). Exporta el estado de cuenta en CSV desde la banca en línea." };
  const headers = table[headerIdx].map(norm);
  const iDate = find(headers, /^fecha/, /valor|liquid/) >= 0 ? find(headers, /^fecha/, /valor|liquid/) : find(headers, /^fecha/);
  const iDesc = find(headers, /descrip|concepto|detalle|movimiento|leyenda/);
  const iRef = find(headers, /referen|folio|autoriz|rastreo/);
  const iCargo = find(headers, /cargo|retiro|debito|salida|egreso/);
  const iAbono = find(headers, /abono|deposito|credito|entrada|ingreso/);
  const iMonto = find(headers, /^(monto|importe)/);
  if (iCargo < 0 && iAbono < 0 && iMonto < 0)
    return { error: `No se reconocieron las columnas de importe. Encabezados encontrados: ${table[headerIdx].join(", ")}. Se esperan "Cargo" y "Abono", o "Monto".` };

  const rows: BankRow[] = [];
  for (const r of table.slice(headerIdx + 1)) {
    const date = parseBankDate(r[iDate] ?? "");
    if (!date) continue; // totales, saldos o pies de página
    let amount: number | null = null;
    if (iCargo >= 0 || iAbono >= 0) {
      const cargo = iCargo >= 0 ? parseAmount(r[iCargo] ?? "") : null;
      const abono = iAbono >= 0 ? parseAmount(r[iAbono] ?? "") : null;
      if (abono) amount = Math.abs(abono);
      else if (cargo) amount = -Math.abs(cargo);
    } else amount = parseAmount(r[iMonto] ?? "");
    if (!amount) continue;
    rows.push({
      date,
      description: (iDesc >= 0 ? r[iDesc] : "").slice(0, 300),
      reference: (iRef >= 0 ? r[iRef] : "").slice(0, 120),
      amount: Math.round(amount * 100) / 100,
    });
  }
  if (!rows.length) return { error: "El archivo no tiene movimientos con fecha e importe que se puedan leer." };
  return { rows };
}

/**
 * Sugerencias de conciliación: mismo sentido (depósito ↔ ingreso, retiro ↔ egreso), mismo importe
 * (±1 centavo) y fecha a ±5 días. Gana la fecha más cercana; cada movimiento se usa una sola vez.
 */
export function suggestMatches<L extends { id: number; date: Date; amount: number }, T extends { id: number; date: Date; amount: number; type: string }>(
  lines: L[],
  txs: T[],
  windowDays = 5,
) {
  const used = new Set<number>();
  const result = new Map<number, T>();
  const ordered = [...lines].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const l of ordered) {
    const type = l.amount > 0 ? "INGRESO" : "EGRESO";
    let best: T | null = null;
    let bestGap = Infinity;
    for (const t of txs) {
      if (used.has(t.id) || t.type !== type || Math.abs(t.amount - Math.abs(l.amount)) > 0.011) continue;
      const gap = Math.abs(t.date.getTime() - l.date.getTime()) / 86_400_000;
      if (gap <= windowDays && gap < bestGap) {
        best = t;
        bestGap = gap;
      }
    }
    if (best) {
      used.add(best.id);
      result.set(l.id, best);
    }
  }
  return result;
}
