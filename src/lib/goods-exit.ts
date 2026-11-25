/*
 * Salidas de mercancía (outbound): cada renglón es un SKU con las cajas que salen y las piezas por caja.
 * Código puro: lo usan el formulario, las acciones y el PDF.
 */

export type ExitLine = { sku: string; boxes: number; piecesPerBox: number };

export const exitPieces = (l: Pick<ExitLine, "boxes" | "piecesPerBox">) => l.boxes * l.piecesPerBox;

export function exitTotals(lines: Pick<ExitLine, "boxes" | "piecesPerBox">[]) {
  return {
    boxes: lines.reduce((a, l) => a + l.boxes, 0),
    pieces: lines.reduce((a, l) => a + exitPieces(l), 0),
  };
}

/** Folio consecutivo: SAL-00001, SAL-00002… */
export const exitFolio = (n: number) => `SAL-${String(n).padStart(5, "0")}`;
export const folioNumber = (folio: string) => Number(folio.replace(/\D/g, "")) || 0;

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
