---
name: Kurier ERP
description: ERP interno de Kurier Fulfillment; una mesa de control profesional, cálida y discreta.
colors:
  kurier-navy: "#1f4e79"
  kurier-navy-deep: "#193f62"
  sidebar-navy: "#163a5c"
  kurier-orange: "#ed7d31"
  kurier-orange-deep: "#d96a1f"
  paper: "oklch(0.984 0.003 247.86)"
  surface: "oklch(1 0 0)"
  ink: "oklch(0.21 0.034 264.67)"
  ink-muted: "oklch(0.52 0.03 257)"
  wash: "oklch(0.967 0.007 247.9)"
  hairline: "oklch(0.925 0.009 255)"
  field-stroke: "oklch(0.89 0.012 255)"
  danger: "oklch(0.577 0.245 27.325)"
  income-ink: "#047857"
  expense-ink: "#be123c"
  chart-income: "#2f6fa8"
  chart-expense: "#d96a1f"
  chart-teal: "#0f9488"
  chart-violet: "#8a63d2"
  chart-slate: "#94a3b8"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  figure:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
  data:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.kurier-navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.kurier-navy-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.wash}"
  button-kurier:
    backgroundColor: "{colors.kurier-orange}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "0 14px"
    height: "36px"
  button-kurier-hover:
    backgroundColor: "{colors.kurier-orange-deep}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
  nav-item:
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "36px"
  status-badge:
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.label}"
---

# Design System: Kurier ERP

## Overview

**Creative North Star: "La mesa de control"**

Kurier ERP es un centro de mando sereno: el negocio completo está a la vista (lo que entra, lo que sale, lo que se debe y quién trabajó) y nada compite con los datos. La sensación es profesional y cálida a la vez. El azul marino de Kurier da seriedad y estructura, el naranja Kurier da calidez en momentos contados, y el papel frío casi blanco del fondo deja respirar tablas densas.

La densidad es de herramienta de trabajo en escritorio. Hay muchas cifras por pantalla, tablas completas y paneles con encabezado, pero ordenados en una retícula tranquila con aire generoso entre grupos. Los componentes son refinados y discretos: bordes de un pixel, sombras casi imperceptibles, una sola familia tipográfica. La marca vive en los detalles precisos: la barra lateral marina con el ícono activo en naranja, los montos alineados y los colores con significado estable.

Lo conocido es una virtud. Botones, campos, menús y diálogos se comportan como en cualquier herramienta seria (base shadcn/ui sobre Radix). La personalidad nunca se paga con extrañeza.

**Key Characteristics:**
- Barra lateral marina fija, contenido sobre papel claro con tarjetas blancas.
- Una sola familia (Geist) en peso 400–600; jerarquía por peso y tamaño, nunca por tipografías de exhibición.
- Color con significado: marino = acción y estructura; naranja = acento de marca y egresos en gráficas; verde/rojo = ingreso/egreso en texto.
- Profundidad casi plana: bordes finos y sombra `xs`; la sombra crece solo como respuesta (hover sobre algo enlazable, menús flotantes).
- Cifras siempre en números tabulares dentro de columnas.

## Colors

Una paleta restringida: marino institucional, un naranja cálido de acento y neutros fríos ligeramente azulados.

### Primary
- **Marino Kurier** (kurier-navy): color de acción y estructura. Botón primario, enlaces de folio, anillo de foco, encabezados de PDF. Es lo que el usuario presiona.
- **Marino profundo** (kurier-navy-deep): hover del primario y fondos que necesitan un paso más oscuro.
- **Marino de barra lateral** (sidebar-navy): fondo de la navegación lateral y de la barra superior en móvil; también el fondo de las pantallas de acceso.

### Secondary
- **Naranja Kurier** (kurier-orange): acento de marca. Ícono del elemento activo en la navegación, insignia "K" del logotipo, botón `btn-kurier` para la acción de marca ocasional y anillo de foco dentro de la barra lateral.
- **Naranja tostado** (kurier-orange-deep): hover del botón naranja y color de la serie "egresos" en gráficas (es el tono que pasa contraste ≥ 3:1 sobre blanco).

### Neutral
- **Papel frío** (paper): fondo de la página, apenas azulado para que las tarjetas blancas se lean como superficies.
- **Superficie** (surface): tarjetas, paneles, menús, campos.
- **Tinta** (ink): texto principal.
- **Tinta tenue** (ink-muted): subtítulos, etiquetas, encabezados de tabla, ejes de gráficas.
- **Lavado** (wash): fondos de hover, encabezado de tabla, pista vacía de barras e íconos en caja.
- **Línea fina** (hairline): bordes de tarjetas y divisores.
- **Trazo de campo** (field-stroke): borde de inputs, un paso más visible que la línea fina.
- **Peligro** (danger): acciones destructivas, siempre como texto rojo sobre fondo rojo al 10 %, nunca como bloque sólido.

### Data
- **Ingreso / egreso en texto** (income-ink, expense-ink): montos positivos y negativos en tablas, indicadores y la línea de tiempo, con signo `+` / `−`.
- **Series de gráficas** (chart-income, chart-expense, chart-teal, chart-violet, chart-slate): orden categórico fijo validado para daltonismo. Ingresos siempre azul, egresos siempre naranja tostado, gris pizarra para "borrador/otros".
- **Antigüedad de saldos:** rampa de severidad de verde azulado (al corriente) a ámbar, naranja, rojo y vino (más de 90 días); vive como variables `--aging-0…4` en `globals.css`.
- **Mapa de calor:** una sola tinta marina de claro a oscuro (`--heat-0…4`).

### Named Rules
**The Navy Acts Rule.** El marino es para lo que se presiona o se sigue (botón primario, folio enlazado, foco). Si algo es marino y no hace nada, sobra.

**The Orange Is Rare Rule.** El naranja Kurier aparece como acento puntual: el ícono activo, el logotipo, una acción de marca. Nunca como fondo de sección ni en más de un botón por vista.

**The Meaning Holds Rule.** Un color con significado no cambia de pantalla a pantalla: ingresos azul en gráficas y verde en texto, egresos naranja en gráficas y rojo en texto, en todo el sistema. El texto nunca usa el color de la serie; la identidad la da la marca de color junto al texto.

## Typography

**Body Font:** Geist (con ui-sans-serif, system-ui)

**Character:** una sola sans neutra y contemporánea carga todo, desde el título de página hasta la cifra de una tabla. La jerarquía sale del peso (400 / 500 / 600) y de pasos de tamaño cortos, como corresponde a una herramienta.

### Hierarchy
- **Headline** (600, 1.75rem, tracking −0.025em): título de cada página en el encabezado, con `text-balance`. En móvil baja a 1.5rem.
- **Figure** (600, 1.5rem): el valor de cada indicador. Usa números proporcionales: a ese tamaño los tabulares se ven sueltos.
- **Title** (600, 0.95rem): título de panel y de tarjeta.
- **Body** (400, 0.875rem): texto de interfaz, celdas de tabla, botones y campos.
- **Label** (500, 0.75rem, tinta tenue): etiquetas de campo, encabezados de tabla, descripciones de panel, pistas.
- **Data** (500, 0.875rem, `tnum`): montos en columnas, siempre alineados a la derecha.
- **Grupo de navegación** (500, 11px, mayúsculas, tracking amplio, blanco al 45 %): el único uso de mayúsculas del sistema, solo en los grupos de la barra lateral.

### Named Rules
**The One Family Rule.** Solo Geist. Nada de tipografías de exhibición, serif ni monoespaciadas como disfraz; la monoespaciada se reserva para códigos reales si algún día aparecen.

**The Tabular Columns Rule.** Toda columna de montos usa números tabulares y se alinea a la derecha; una cifra suelta grande no.

## Layout

- **Estructura:** barra lateral fija de 240px a partir de `lg` (1024px); debajo de eso, barra superior marina de 56px con menú deslizable desde la izquierda.
- **Contenedor:** ancho máximo de 1400px centrado; márgenes laterales de 16px en móvil, 24px desde `sm` y 40px desde `lg`; 24–32px arriba.
- **Encabezado de página:** título y subtítulo a la izquierda, acciones a la derecha, separados del contenido por 24–32px.
- **Retícula:** indicadores en 1 → 2 (`sm`) → 4 (`xl`) columnas con separación de 16px; paneles en 1 → 2 o 3 columnas con 24px. Lo principal ocupa dos tercios y lo de apoyo un tercio. Los formularios laterales tienen 340px fijos junto a la tabla.
- **Ritmo:** 20px de relleno dentro de paneles, 14px de alto en sus encabezados, renglones de tabla de 10px vertical. Lo relacionado va junto; los grupos distintos se separan con 24px.
- **Tablas:** dentro de su tarjeta, con desplazamiento horizontal propio en pantallas angostas; la página nunca se desplaza de lado.

## Elevation & Depth

Casi plano, con capas tonales. La profundidad viene de tres planos: papel frío → tarjeta blanca con borde fino → menú o tooltip flotante. Las superficies en reposo llevan solo `shadow-xs`.

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): tarjetas, botones secundarios y campos.
- **Respuesta** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): hover de un indicador enlazado; dice "esto se abre".
- **Flotante** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): menús desplegables, hojas laterales y diálogos.

### Named Rules
**The Flat-By-Default Rule.** En reposo todo es plano. La sombra crece solo como respuesta a estado (hover sobre algo enlazable) o por estar encima de la página (menú, diálogo). Nunca hay sombras de color ni halos.

**The Still Target Rule.** En un hover, lo que recibe el cursor no se mueve; se eleva su superficie interior. Así el área de clic nunca se escapa del puntero.

## Shapes

Esquinas suavemente redondeadas a partir de un radio base de 10px. Las tarjetas y paneles usan 14px, botones y campos 10px, los elementos de menú 8px, y las insignias de estado, los avatares y los puntos de estado son completamente redondos. Los bordes son siempre de un pixel y completos; no hay barras de color en un solo lado. En las gráficas, las barras tienen la punta redondeada a 4px y la base recta, y entre marcas que se tocan hay 2px de aire.

## Components

### Buttons
Refinados y discretos: compactos, con estados claros pero sin teatro.
- **Shape:** esquinas de 10px, 36px de alto (32px en botones de shadcn por defecto), ícono de 16px con 6px de separación.
- **Primary:** fondo marino, texto blanco. Una acción primaria por encabezado ("Nueva factura").
- **Secondary:** fondo blanco con borde fino; el hover pasa a lavado. Es la mayoría de las acciones.
- **Kurier:** fondo naranja para la acción de marca ocasional.
- **Danger:** texto rojo sobre rojo al 10 %; siempre con confirmación antes de borrar.
- **States:** foco con anillo de 3px del marino al 40 %; al presionar baja 1px; deshabilitado al 50 % de opacidad. Los envíos muestran su texto de espera ("Creando…").

### Status Badges
- **Style:** píldora completamente redonda de 20px de alto, fondo tintado al 50, texto 700 del mismo tono, anillo interior al 20 % y un punto de color de 6px antes de la etiqueta.
- **Vocabulary:** borrador pizarra, enviada azul, aceptada/pagada verde, rechazada/vencida rojo, facturada violeta, pendiente ámbar, pago parcial cielo, cancelada pizarra. El significado es fijo en todo el sistema.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** superficie blanca sobre papel frío.
- **Shadow Strategy:** reposo (ver Elevation & Depth); respuesta solo si toda la tarjeta es un enlace.
- **Border:** línea fina de 1px.
- **Internal Padding:** 20px. El panel con encabezado (`Panel`) separa título, descripción y acción con un divisor y no anida otra tarjeta dentro.

### Inputs / Fields
- **Style:** fondo blanco, trazo de campo, esquinas de 10px, 36px de alto, sombra de reposo. Los selects llevan su propia flecha; los de archivo, un botón lavado interno.
- **Focus:** el borde pasa a marino con anillo de 3px al 30 %; el cursor de texto es marino.
- **Error / Disabled:** borde de peligro con `aria-invalid`; deshabilitado sobre lavado al 60 %.
- **Label:** encima del campo, en etiqueta tenue de 12px; la pista va debajo con el mismo estilo.

### Navigation
- **Style:** barra lateral marina; grupos con su título en mayúsculas pequeñas; elementos de 36px con ícono de 16px.
- **States:** en reposo, blanco al 75 % con el ícono atenuado; en hover, fondo blanco al 6 %; activo con fondo blanco al 10 %, texto completo, peso 500 e ícono naranja Kurier, más `aria-current="page"`.
- **Mobile:** barra superior marina con botón de menú y hoja deslizable con la misma navegación; el menú del usuario (perfil, idioma, salir) va al pie en ambos casos.

### Indicadores (Stat)
Etiqueta tenue con un ícono en caja lavada, cifra en Figure (verde para ingresos y rojo para egresos cuando aplica) y debajo la variación contra el periodo anterior: una píldora con flecha que es verde cuando el cambio es bueno y rojo cuando es malo, más una pista. Si el indicador es enlace, al pasar el cursor el enlace se queda quieto y la tarjeta interior se eleva 2px con la sombra de respuesta (220ms), el ícono toma el marino al 10 % y aparece una flecha pequeña abajo a la derecha. Al presionar, la tarjeta regresa a su lugar.

### Charts
Gráficas propias en HTML y CSS: columnas agrupadas, barras segmentadas, listas de barras y un mapa de calor de actividad.
- **Marks:** columnas de hasta 14px (dos series) o 24px (una sola), con punta de 4px; barras horizontales de 8px; barra segmentada de 28px con el porcentaje dentro solo si cabe.
- **Chrome:** cuadrícula de 1px en línea fina, ejes en etiqueta tenue con montos cortos ($12.5k); la leyenda va arriba a la izquierda cuando hay dos series o más.
- **Interaction:** tooltip oscuro en hover y foco con todas las series del punto (el valor en negritas, el nombre atenuado) y botón "Ver tabla" en cada gráfica.
- **Entrance:** al aparecer, cada gráfica se descubre desde su línea base con un recorte (clip-path), no con escala, para no deformar las puntas: las columnas suben, las barras y la barra segmentada avanzan hacia la derecha y el mapa de calor aparece con un fundido de la semana más vieja a la más nueva. Duran 400ms con el escalonado topado en 160ms y corren una vez por montaje. La vista de tabla ocupa el mismo alto que la gráfica, así cambiar de vista no mueve el contenido de abajo.

### Línea de tiempo de actividad
Lista de registros recientes con un ícono circular tintado por tipo (factura azul, cotización violeta, pago verde, movimiento pizarra, nómina ámbar, cliente verde azulado) unido por una línea fina vertical. Cada renglón lleva el tipo en tinta tenue, el folio en peso 500, el monto con signo y el tiempo relativo.

### Empty States
Ícono en círculo lavado, una frase que dice qué va a aparecer ahí y, cuando existe, la acción que lo crea ("Dar de alta el primero").

## Do's and Don'ts

### Do:
- **Do** usar el marino solo en lo accionable y el naranja Kurier como acento puntual (The Orange Is Rare Rule).
- **Do** mantener ingresos en azul y egresos en naranja tostado en todas las gráficas, y verde/rojo con signo en el texto.
- **Do** alinear los montos a la derecha con números tabulares dentro de tablas.
- **Do** dar a cada gráfica tooltip en hover y foco, leyenda cuando hay dos series o más y vista de tabla.
- **Do** reutilizar `PageHeader`, `Panel`, `Stat`, `Empty`, `Field`, `StatusBadge` y los atajos `btn-*`, `input` y `card` antes de crear algo nuevo.
- **Do** usar los tokens de movimiento de `globals.css`: `--ease-out` (cubic-bezier(0.16, 1, 0.3, 1)), `--dur-feedback` 150ms, `--dur-state` 220ms y `--dur-data` 400ms. El movimiento explica estado o la llegada de datos; nunca hace esperar.
- **Do** mover la superficie interior en un hover, nunca el elemento que recibe el cursor (The Still Target Rule).
- **Do** respetar `prefers-reduced-motion`: sin desplazamientos, cada gráfica aparece completa con un solo fundido de 220ms (sin escalonado) y las tarjetas cambian de sombra y color sin moverse.

### Don't:
- **Don't** anidar tarjetas dentro de tarjetas ni usar barras de color en un solo lado de una caja.
- **Don't** poner un texto de categoría (eyebrow) sobre los títulos; el título se sostiene solo.
- **Don't** usar tipografías de exhibición, degradados en texto, vidrio o desenfoque decorativo.
- **Don't** usar verde contra rojo para distinguir dos series de una gráfica; no pasa la prueba de daltonismo.
- **Don't** usar sombras de color, halos ni sombras duras desplazadas.
- **Don't** usar emoji o caracteres Unicode como íconos; los íconos son de lucide con el mismo trazo.
- **Don't** agregar coreografías de carga de página, contadores que suben ni entradas en cascada de paneles: el usuario eligió movimiento sutil y rápido.
- **Don't** usar rebotes ni curvas elásticas.
