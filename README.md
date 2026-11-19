# Kurier ERP

ERP interno de **Kurier Fulfillment**.

**Fase 1:** cotizaciones, facturas, contabilidad básica (ingresos y egresos) y PDFs con la marca de la empresa.

> Las facturas son **documentos informativos**: no son CFDI y no se timbran con el e.firma (FIEL) ni con un PAC. Cada PDF lo dice en el pie de página.

## Stack

- Next.js 15 (App Router y Server Actions), React 19, TypeScript
- Prisma + PostgreSQL (Prisma Postgres en Vercel)
- Tailwind CSS 4
- `@react-pdf/renderer` para generar los PDFs en el servidor

## Despliegue en Vercel

1. Importa el repositorio en Vercel.
2. En **Optional Integrations → Prisma Postgres** da clic en **Add**. Esto crea la base y la variable `DATABASE_URL`.
3. En **Environment Variables** agrega `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` y `ERP_OWNER_EMAIL` (ver *Acceso con Google* abajo).
4. Da clic en **Deploy**. El script `vercel-build` aplica las migraciones, carga el catálogo de servicios (sin sobrescribir lo que ya exista) y compila.

## Desarrollo local

```bash
npm install
cp .env.example .env        # pega tu DATABASE_URL de Postgres
npm run db:migrate          # crea las tablas
npm run db:seed             # configuración y catálogo de servicios
npm run db:seed -- --demo   # (opcional) datos de ejemplo; NO lo corras contra producción
npm run dev                 # http://localhost:3000
```

Para cambiar el modelo de datos edita `prisma/schema.prisma` y corre `npm run db:migrate:dev -- --name descripcion`. Esto genera una migración nueva; súbela al repositorio junto con el cambio.

## Módulos

| Módulo | Ruta | Qué hace |
|---|---|---|
| Inicio | `/` | Indicadores del mes, saldo por cobrar, últimas facturas y cotizaciones |
| Cotizaciones | `/cotizaciones` | Propuesta de tarifas por sección del tarifario: perfil de la operación, servicios con tarifa y descripción, costo mensual estimado (conceptos con cantidad), tabla **costo por pedido**, **escenarios por volumen** (ej. 250 / 500 / 1,000 pedidos) y condiciones comerciales. Estatus, duplicar y **facturar con estas tarifas** |
| Facturas | `/facturas` | Formato semanal de Kurier: periodo, volumen, almacenamiento, condiciones de pago y conceptos **al costo** (guías). Alta directa o con las tarifas de una cotización, **registro de pagos** y cancelación |
| Contabilidad | `/contabilidad` | Movimientos de ingreso y egreso por categoría. Cada pago de factura genera su ingreso automáticamente |
| Reportes | `/contabilidad/reportes` | Estado de resultados (flujo), resumen de IVA estimado y antigüedad de cuentas por cobrar |
| Clientes | `/clientes` | Datos fiscales y de contacto, saldo y **estado de cuenta en PDF** |
| Tarifario | `/servicios` | Tarifario estándar V5 por secciones (incluye Preparación Full / FBA), con la nota de cada sección (se imprime en la cotización) |
| PDF del tarifario | `/servicios/tablas` | Genera el PDF del tarifario completo. Aquí se editan la introducción, las condiciones, el recuadro final y las tablas informativas (Incluido en todos los planes, tarifas preferenciales, cobertura por zonas, SLA); cada tabla puede imprimirse también en las cotizaciones |
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

- **Logo:** súbelo desde *Configuración* (se guarda en la base de datos). Como respaldo, el PDF busca `public/branding/logo.png`. Si no hay logo, muestra el nombre comercial con un ícono en el color de acento.
- **Colores:** el color principal y el de acento se configuran en *Configuración* y se aplican a encabezados, tablas y totales.
- **Datos de la empresa:** la razón social, el RFC, la dirección y los datos bancarios aparecen en el encabezado del PDF. Los datos bancarios solo salen en las facturas.

## Estructura

```
prisma/schema.prisma      modelo de datos
prisma/tarifario.ts       tarifario estándar V5 (secciones, servicios y condiciones)
prisma/seed.ts            carga idempotente del tarifario y datos demo
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
- **Acceso:** inicio de sesión con Google (Auth.js). Ver *Acceso con Google*.

## Acceso con Google

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un **ID de cliente OAuth** de tipo *Aplicación web*.
   - Orígenes autorizados: `https://TU-DOMINIO` (y `http://localhost:3000` para local).
   - URI de redirección: `https://TU-DOMINIO/api/auth/callback/google` (y `http://localhost:3000/api/auth/callback/google`).
2. En Vercel agrega `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` (del paso 1), `AUTH_SECRET` (texto aleatorio largo, p. ej. `npx auth secret`) y `ERP_OWNER_EMAIL` (tu correo de Google: la cuenta maestra).
3. La cuenta maestra entra directo. Desde **Usuarios y accesos** genera links de invitación (opcionalmente para un correo específico, con rol y vencimiento). Quien abre el link entra con su Google y queda dado de alta.
4. Roles: *Cuenta maestra* (todo), *Administrador* (puede invitar usuarios), *Usuario* (usa el ERP). Desactivar a alguien le quita el acceso en minutos.
5. Para probar en local sin Google: `AUTH_DEV_LOGIN=1` en `.env.development.local` (nunca funciona en producción).

## Idioma

Español / English desde el menú del usuario (abajo a la izquierda), el perfil o la pantalla de inicio de sesión. Las traducciones están en `src/lib/i18n/en.ts` (la clave es el texto en español). Los PDF para clientes siguen en español.

## Integración con el WMS

**Hoy (PDF):** en *Facturas → Importar del WMS* sube los estados de cobro (`invoice-COB-….pdf`). El ERP los lee, reconoce al cliente por su *Nombre en el WMS*, agrupa los movimientos por concepto y aplica las **tarifas negociadas del cliente** (ficha del cliente → *Tarifas negociadas*). Lo que no tenga tarifa del cliente usa el tarifario estándar y, si tampoco existe, el precio del WMS. Los fletes se facturan al costo. Antes de crear la factura se muestran las diferencias contra lo que cobró el WMS.

**Después (API):** el WMS puede enviar el mismo estado de cobro en JSON:

```
POST /api/wms/statements
Authorization: Bearer <WMS_API_TOKEN>
Content-Type: application/json

{ "folio": "COB-2026-10-19-0006", "clientName": "Basic&Pure",
  "periodFrom": "2026-10-19", "periodTo": "2026-10-25",
  "lines": [ { "date": "2026-10-24", "section": "MANIOBRAS", "concept": "Procesamiento de pedido",
               "description": "Procesamiento de pedido P-1158", "quantity": 1, "unit": "pedido",
               "unitPrice": 25, "amount": 25, "orderRef": "P-1158" } ],
  "subtotal": 25, "tax": 4, "total": 29 }
```

Acepta también `{ "statements": [ … ] }` (hasta 100). Define `WMS_API_TOKEN` en Vercel para activarla; sin esa variable responde 503. Los estados recibidos quedan *por facturar* para revisarlos, igual que los PDF. El formato completo está en `src/lib/wms/types.ts`.
