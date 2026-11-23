"use client";

import { forwardRef, useEffect, useRef, useState } from "react";

/*
 * Campo para cantidades con separador de miles mientras se escribe: 1234567.5 → "1,234,567.5".
 * Es un input de texto (los de tipo number no aceptan comas) con teclado numérico en el celular.
 *  - Controlado: `value` (número) + `onValueChange(n)`.
 *  - Sin controlar (formularios): `name` + `defaultValue`; se envía con comas y el servidor las quita (numv).
 * `decimals` limita los decimales (0 = solo enteros); con `allowNegative` acepta signo menos.
 * Un 0 se muestra vacío (como el resto de los campos de cantidades).
 */
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange" | "step" | "min" | "max"> & {
  value?: number | string | null;
  defaultValue?: number | string | null;
  onValueChange?: (n: number, text: string) => void;
  decimals?: number;
  allowNegative?: boolean;
};

const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Limpia lo tecleado y lo agrupa con comas (conserva el punto decimal y los decimales que lleve). */
export function formatTyping(raw: string, decimals = 2, allowNegative = false) {
  const neg = allowNegative && raw.trim().startsWith("-");
  let s = raw.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  let int = dot === -1 ? s : s.slice(0, dot);
  let frac = dot === -1 ? null : s.slice(dot + 1).replace(/\./g, "");
  int = int.replace(/^0+(?=\d)/, "");
  if (decimals === 0) frac = null;
  else if (frac !== null) frac = frac.slice(0, decimals);
  s = `${group(int)}${frac !== null ? `.${frac}` : ""}`;
  return `${neg ? "-" : ""}${s}`;
}

export const parseNumber = (text: string) => {
  const n = Number(String(text).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const show = (v: number | string | null | undefined, decimals: number, allowNegative: boolean) => {
  if (v === null || v === undefined || v === "" || Number(v) === 0) return "";
  const n = typeof v === "number" ? v : parseNumber(v);
  // Sin ceros de relleno: 1500 → "1,500", 1500.5 → "1,500.5"
  return formatTyping(String(Math.round(n * 10 ** decimals) / 10 ** decimals), decimals, allowNegative);
};

export const NumberField = forwardRef<HTMLInputElement, Props>(function NumberField(
  { value, defaultValue, onValueChange, decimals = 2, allowNegative = false, className, onBlur, ...rest },
  ref,
) {
  const controlled = value !== undefined;
  const [text, setText] = useState(() => show(controlled ? value : defaultValue, decimals, allowNegative));
  const inner = useRef<HTMLInputElement | null>(null);

  // Si el valor cambia desde fuera (p. ej. un botón que lo llena), se refleja en el campo
  useEffect(() => {
    const target = typeof value === "number" ? value : parseNumber(String(value ?? ""));
    if (controlled && parseNumber(text) !== target) setText(show(value, decimals, allowNegative));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...rest}
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      type="text"
      inputMode={decimals === 0 ? "numeric" : "decimal"}
      autoComplete="off"
      className={className}
      value={text}
      onChange={(e) => {
        const el = e.currentTarget;
        const raw = el.value;
        const caret = el.selectionStart ?? raw.length;
        // Cuántos dígitos/punto hay antes del cursor, para dejarlo en el mismo lugar tras agregar comas
        const before = raw.slice(0, caret).replace(/[^\d.-]/g, "").length;
        const next = formatTyping(raw, decimals, allowNegative);
        setText(next);
        onValueChange?.(parseNumber(next), next);
        requestAnimationFrame(() => {
          const input = inner.current;
          if (!input || document.activeElement !== input) return;
          let pos = 0;
          let seen = 0;
          while (pos < next.length && seen < before) {
            if (/[\d.-]/.test(next[pos])) seen++;
            pos++;
          }
          input.setSelectionRange(pos, pos);
        });
      }}
      onBlur={(e) => {
        // Al salir: sin punto colgando ("1,200." → "1,200")
        if (text.endsWith(".")) setText(text.slice(0, -1));
        onBlur?.(e);
      }}
    />
  );
});
