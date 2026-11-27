-- Ubicación aproximada del destino (OpenStreetMap) para ordenar las rutas de reparto
ALTER TABLE "Shipment" ADD COLUMN "geoLat" DOUBLE PRECISION,
ADD COLUMN "geoLng" DOUBLE PRECISION,
ADD COLUMN "geoLevel" TEXT NOT NULL DEFAULT '',
ADD COLUMN "geoKey" TEXT NOT NULL DEFAULT '';
