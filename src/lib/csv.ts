/**
 * CSV para Excel: BOM UTF-8 (acentos correctos al abrirlo con doble clic), coma como separador,
 * fin de línea CRLF, montos como número con punto decimal y fechas yyyy-mm-dd.
 */
type Cell = string | number | boolean | Date | null | undefined;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  let s = String(v);
  // Evita que Excel interprete el texto como fórmula (inyección de fórmulas en CSV)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Cell[][]) {
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(name: string, csv: string) {
  const file = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
