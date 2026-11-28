import React from "react";
import path from "node:path";
import * as R from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { Lang } from "@/lib/i18n/core";

/*
 * Primitivas de @react-pdf con idioma. Los PDFs importan View/Text/Page de aquí (no de @react-pdf/renderer).
 * Helvetica no tiene glifos chinos: con `PdfLang lang="zh"` (lo pone PdfDoc) View/Text/Page cambian la fuente
 * a Noto Sans SC. La fuente solo se carga cuando un PDF en chino la usa; en español e inglés sigue Helvetica.
 *
 * El idioma no va en un React context: Next no permite createContext en el código de servidor (las rutas de
 * PDF lo son). Va en una variable del módulo que fija PdfLang al renderizarse. Es seguro porque react-pdf
 * renderiza el árbol completo de forma síncrona (raíz legacy) dentro de renderToBuffer, antes de cualquier
 * await: dos PDFs nunca se mezclan, y el padre (PdfLang) se renderiza antes que sus hijos.
 */

export { Document, Image, Svg, Path, Rect, Circle, StyleSheet, Font } from "@react-pdf/renderer";

// Noto Sans SC (licencia OFL) recortada a GB2312 + latín: ~2.3 MB por peso. Ver src/pdf/fonts.
const FONT_DIR = path.join(process.cwd(), "src", "pdf", "fonts");
R.Font.register({ family: "NotoSansSC", src: path.join(FONT_DIR, "NotoSansSC-Regular.ttf") });
R.Font.register({ family: "NotoSansSC-Bold", src: path.join(FONT_DIR, "NotoSansSC-Bold.ttf") });

/** Fuentes estándar → equivalentes con chino (el chino no lleva cursiva: se usa la regular). */
const ZH_FONT: Record<string, string> = {
  Helvetica: "NotoSansSC",
  "Helvetica-Oblique": "NotoSansSC",
  "Helvetica-Bold": "NotoSansSC-Bold",
  "Helvetica-BoldOblique": "NotoSansSC-Bold",
};

const CJK = /[⺀-鿿豈-﫿＀-￯]/;

/*
 * Cortes de línea: sin guiones automáticos (evita "FI-NANCIERO", folios cortados, etc.).
 * El chino no separa palabras con espacios, así que cada carácter chino puede quedar al final de una
 * línea (las piezas vacías evitan que react-pdf agregue un guion al cortar). El resto no cambia.
 */
R.Font.registerHyphenationCallback((word) => {
  if (word.length < 2 || !CJK.test(word)) return [word];
  const out: string[] = [];
  let latin = "";
  for (const ch of word) {
    if (CJK.test(ch)) {
      if (latin) out.push(latin, "");
      latin = "";
      out.push(ch, "");
    } else latin += ch;
  }
  if (latin) out.push(latin);
  return out;
});

let current: Lang = "es";
const docLang = () => current;

/** Idioma del documento para las primitivas (lo fija PdfDoc; todo PDF debe pasar por aquí). */
export function PdfLang({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  current = lang;
  return <>{children}</>;
}

type AnyStyle = Style | null | undefined | false | AnyStyle[];

function zhStyle(style: AnyStyle): AnyStyle {
  if (!style) return style;
  if (Array.isArray(style)) return style.map(zhStyle);
  const f = style.fontFamily;
  return typeof f === "string" && ZH_FONT[f] ? { ...style, fontFamily: ZH_FONT[f] } : style;
}

function styleFor<S>(style: S): S {
  const zh = docLang() === "zh";
  return (zh ? zhStyle(style as AnyStyle) : style) as S;
}

/** ¿El texto trae caracteres chinos? (p. ej. el nombre de un cliente chino en un PDF en español) */
const hasCjk = (c: React.ReactNode): boolean =>
  typeof c === "string" ? CJK.test(c) : Array.isArray(c) ? c.some(hasCjk) : false;

/** ¿El estilo indica esta propiedad? (si no, el texto la hereda del contenedor) */
const has = (style: AnyStyle, key: "fontFamily" | "lineHeight" | "fontSize"): boolean => (Array.isArray(style) ? style.some((x) => has(x, key)) : !!style && style[key] != null);

/**
 * Noto Sans SC trae más interlineado que Helvetica: sin un lineHeight propio, el texto en chino ocupa ~30 % más
 * de alto y los formatos de tamaño fijo (guía 4 × 6) se enciman. Se usa uno parecido al de Helvetica.
 */
const ZH_LINE = { lineHeight: 1.2 };
// Solo con fontSize propio: un lineHeight relativo sin fontSize se calcula sobre 12 pt y separa de más los renglones.
const tight = (style: AnyStyle): AnyStyle => (has(style, "lineHeight") || !has(style, "fontSize") ? style : [style, ZH_LINE]);

/**
 * En cualquier idioma, un texto con caracteres chinos usa Noto Sans SC (Helvetica no los tiene):
 * se cambia su fuente, o se le pone la regular si la heredaba.
 */
export function Text(props: React.PropsWithChildren<R.TextProps>) {
  const zhDoc = docLang() === "zh";
  if (!zhDoc && !hasCjk(props.children)) return <R.Text {...props} />;
  const zh = zhStyle(props.style as AnyStyle);
  const withFont = zhDoc || has(zh, "fontFamily") ? zh : [zh, { fontFamily: "NotoSansSC" }];
  // Los textos con render (número de página del pie fijo) no llevan lineHeight: react-pdf deja de dibujarlos.
  return <R.Text {...props} style={(props.render ? withFont : tight(withFont)) as R.TextProps["style"]} />;
}

export function View(props: React.PropsWithChildren<R.ViewProps>) {
  return <R.View {...props} style={styleFor(props.style)} />;
}

/** En chino la página arranca con Noto Sans SC aunque no indique fuente (los textos la heredan). */
export function Page(props: React.PropsWithChildren<R.PageProps>) {
  const zh = docLang() === "zh";
  const style = styleFor(props.style);
  return <R.Page {...props} style={zh ? [{ fontFamily: "NotoSansSC" }, ...(Array.isArray(style) ? style : style ? [style] : [])] : style} />;
}
