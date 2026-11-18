# Kurier ERP

ERP interno de **Kurier Fulfillment**.

**Fase 1:** cotizaciones, facturas, contabilidad básica (ingresos y egresos) y PDFs con la marca de la empresa.

> Las facturas son **documentos informativos**: no son CFDI y no se timbran con el e.firma (FIEL) ni con un PAC. Cada PDF lo dice en el pie de página.

## Stack

- Next.js 15 (App Router y Server Actions), React 19, TypeScript
- Prisma con SQLite para desarrollo local (se puede cambiar a PostgreSQL)
- Tailwind CSS 4
- `@react-pdf/renderer` para generar los PDFs en el servidor

## Arranque rápido

```bash
npm install
cp .env.example .env
npm run db:push              # crea la base de datos
npm run db:seed              # configuración y catálogo de servicios de fulfillment
npm run db:seed -- --demo    # (opcional) clientes, cotización, factura y movimientos de ejemplo
npm run dev                  # http://localhost:3000
```

## Módulos

| Módulo | Ruta | Qué hace |
|---|---|---|
| Inicio | `/` | Indicadores del mes, saldo por cobrar, últimas facturas y cotizaciones |
| Cotizaciones | `/cotizaciones` | Alta con conceptos del catálogo o conceptos libres, descuentos por línea, estatus (borrador, enviada, aceptada, rechazada), duplicar y **convertir a factura** |
| Facturas | `/facturas` | Alta directa o desde una cotización, vencimientos, **registro de pagos** (parciales o totales), cancelación |
| Contabilidad | `/contabilidad` | Movimientos de ingreso y egreso por categoría. Cada pago de factura genera su ingreso automáticamente |
| Reportes | `/contabilidad/reportes` | Estado de resultados (flujo), resumen de IVA estimado y antigüedad de cuentas por cobrar |
| Clientes | `/clientes` | Datos fiscales y de contacto, saldo y **estado de cuenta en PDF** |
| Servicios | `/servicios` | Catálogo de precios (almacenaje, pick & pack, envíos…) |
| Configuración | `/configuracion` | Logo, colores, razón social, RFC, datos bancarios, folios, IVA y plazos |

## PDFs

| Documento | Endpoint |
|---|---|
| Cotización | `/api/pdf/cotizacion/:id` |
| Factura | `/api/pdf/factura/:id` |
| Estado de cuenta | `/api/pdf/estado-cuenta/:clientId` |
| Reporte financiero | `/api/pdf/reporte?from=AAAA-MM-DD&to=AAAA-MM-DD` |

Agrega `?download` (o `&download`) a cualquier endpoint para descargar el archivo en lugar de abrirlo en el navegador.

### Marca

- **Logo:** súbelo desde *Configuración* o colócalo en `public/branding/logo.png` (también acepta `.jpg`). Si no hay logo, el PDF muestra el nombre comercial con un ícono en el color de acento.
- **Colores:** el color principal y el de acento se configuran en *Configuración* y se aplican a encabezados, tablas y totales.
- **Datos de la empresa:** la razón social, el RFC, la dirección y los datos bancarios aparecen en el encabezado del PDF. Los datos bancarios solo salen en las facturas.

## Estructura

```
prisma/schema.prisma      modelo de datos
prisma/seed.ts            catálogo base y datos demo
src/app/                  páginas (App Router)
src/app/actions/          server actions (lógica de negocio)
src/app/api/pdf/          endpoints que generan los PDFs
src/pdf/                  plantillas de los PDFs (brand.tsx es el layout de marca)
src/lib/                  cálculo de totales, importe con letra, reportes y folios
```

## Notas técnicas

- **Folios:** se reservan dentro de una transacción (`COT-00001`, `FAC-00001`). El prefijo y el siguiente número se pueden cambiar en *Configuración*.
- **Montos:** se redondean a 2 decimales por línea. El IVA se calcula sobre el importe después del descuento.
- **IVA de los pagos:** cuando se registra un pago, el IVA que contiene se calcula en proporción al total de la factura.
- **Producción con PostgreSQL:** cambia `provider` a `"postgresql"` en `prisma/schema.prisma` y ajusta `DATABASE_URL`.
