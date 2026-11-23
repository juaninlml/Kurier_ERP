-- Última milla: entrega el mismo día o al día siguiente
ALTER TABLE "Shipment" ADD COLUMN "serviceLevel" TEXT NOT NULL DEFAULT 'MISMO_DIA';
