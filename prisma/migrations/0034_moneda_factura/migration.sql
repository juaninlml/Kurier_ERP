-- Moneda de la factura (MXN o CNY) y tipo de cambio usado: MXN por 1 unidad de la moneda de la factura
ALTER TABLE "Invoice" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MXN',
ADD COLUMN "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;
