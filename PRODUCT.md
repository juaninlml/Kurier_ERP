# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipo interno de **Kurier Fulfillment** (CDMX, México). No hay usuarios externos; los clientes de Kurier solo reciben PDFs.

- **Dueño / dirección:** revisa ingresos, egresos, utilidad y saldos por cobrar; aprueba cotizaciones. Es la cuenta maestra.
- **Administración:** captura facturas (incluido lo importado del WMS), pagos, movimientos contables, gastos fijos y nómina semanal.
- **Contador externo:** consulta reportes, resumen de IVA estimado y movimientos.
- **Ventas / comercial:** arma cotizaciones a partir del tarifario y da seguimiento a prospectos.
- **Empleados de almacén:** solo usan el kiosco de checadas (`/kiosco`) en un dispositivo activado; no entran al ERP.

Roles en el sistema: OWNER (cuenta maestra), ADMIN, USER.

## Product Purpose

Tener **toda la operación administrativa de Kurier en un solo lugar** y dejar las hojas de cálculo dispersas: cotizar, facturar, cobrar, llevar ingresos y egresos, nómina y asistencias. Para el equipo, el éxito es dejar de abrir una hoja de cálculo para saber qué se cobró, qué se debe, cuánto cuesta operar y quién vino a trabajar.

## Positioning

Es un ERP hecho para la operación de un fulfillment, no uno genérico. Las cotizaciones usan el tarifario estándar V5 de Kurier, con escenarios por volumen y costo por pedido. Las facturas siguen el formato semanal de Kurier y se arman con los estados de cobro del WMS más las tarifas negociadas de cada cliente. La nómina aplica las prestaciones de ley mexicanas a jornada semanal.

## Operating Context

- **Uso principal:** escritorio, en oficina (laptop/PC). El celular es secundario y debe funcionar, pero no manda el diseño.
- **Kiosco:** un teléfono o tablet fijo en el almacén donde los empleados checan entrada, comida y salida.
- **Documentos:** PDFs con la marca de la empresa (cotización, factura, estado de cuenta, reporte financiero, tarifario, recibo de nómina), siempre en español.
- **Ciclos:** facturación y nómina semanales; reportes por mes, trimestre o año.
- **Integración:** WMS propio. Hoy se suben los PDF de estados de cobro (`invoice-COB-…`); después llegarán por la API `/api/wms/statements`.
- **Acceso:** correo + código TOTP de una app autenticadora, con altas por link de invitación. No hay contraseñas ni "Iniciar sesión con Google" (decisión explícita).

## Capabilities and Constraints

- **Módulos:** Inicio (indicadores, flujo de 12 meses, cobranza, embudo, actividad), Cotizaciones, Facturas, Importar del WMS, Clientes (con tarifas negociadas y estado de cuenta), Tarifario y su PDF, Contabilidad, Gastos fijos y punto de equilibrio, Nómina, Asistencias y kiosco, Reportes, Usuarios y accesos, Configuración, Perfil.
- **Facturas informativas:** no son CFDI. No se timbran con e.firma/FIEL ni con un PAC, y cada PDF lo dice. No agregar campos SAT/CFDI ni timbrado salvo que se pida.
- **Moneda e impuestos:** solo MXN, IVA 16 % por defecto (configurable). Los montos se redondean a 2 decimales por línea.
- **Contabilidad:** movimientos de ingreso/egreso por categoría más reportes. No es partida doble. Cada pago de factura genera su ingreso automáticamente.
- **Nómina:** semanal, con antigüedad, vacaciones, prima vacacional y aguinaldo. Sin ISR ni carga patronal.
- **Folios:** `COT-00001` y `FAC-00001`, con prefijo y consecutivo configurables.
- **Idioma:** la interfaz está en español y tiene traducción al inglés (la clave es el texto en español, en `src/lib/i18n/en.ts`). Formularios profundos, editores y PDFs siguen solo en español.
- **Stack existente:** Next.js 15 (App Router, Server Actions), React 19, TypeScript, Prisma + PostgreSQL (Prisma Postgres en Vercel), Tailwind CSS 4, shadcn/ui (Radix, lucide), `@react-pdf/renderer`. Se despliega en Vercel.
- **Fases futuras (sin decidir):** probablemente otros módulos de fulfillment (inventario, pedidos). El CFDI queda fuera "por el momento".

## Brand Commitments

- **Nombre:** Kurier ERP, de Kurier Fulfillment. En la interfaz aparece la firma "Fulfillment · CDMX".
- **Colores de marca:** azul `#1f4e79` (principal) y naranja Kurier `#ed7d31` (acento). En los PDFs, el color principal y el de acento se configuran en *Configuración*.
- **Logo:** lo sube el usuario desde *Configuración*; como respaldo se usa `public/branding/logo.png`. Hoy no hay ningún logo en el repositorio.
- **Formatos de documento:** siguen los PDFs propios de Kurier (cotización tipo Cestco Dental, factura INVK1, Tarifario V5).
- **Voz:** español de México, directo y operativo ("Por cobrar", "Registrar movimiento", "Todo al corriente").

## Evidence on Hand

- Tarifario estándar V5 completo en `prisma/tarifario.ts`.
- Datos demo opcionales con `npm run db:seed -- --demo` (solo local, nunca contra producción).
- No hay testimonios, casos de clientes, métricas publicables ni capturas oficiales. No inventarlos.

## Product Principles

1. **Una sola fuente de verdad.** Si un dato ya existe en el sistema (pago, tarifa, empleado), se reutiliza; nunca se pide capturarlo dos veces.
2. **La operación de Kurier manda.** Formatos, ciclos semanales y terminología siguen cómo trabaja Kurier, no cómo lo haría un ERP genérico.
3. **Cifras honestas.** Lo informativo se marca como informativo (facturas no CFDI, IVA estimado); nada aparenta ser fiscal o definitivo sin serlo.
4. **Rápido de leer en escritorio.** El dueño y el contador deben entender el estado del negocio de un vistazo; la captura diaria debe ser rápida para administración.
5. **Acceso cuidado.** Solo entra quien fue invitado, con autenticador, y los cambios sensibles (usuarios, nómina) quedan en manos de OWNER/ADMIN.
