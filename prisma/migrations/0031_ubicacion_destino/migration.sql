-- Ubicación exacta del destino: link que da el cliente y sus coordenadas
ALTER TABLE "Shipment" ADD COLUMN "destLocationUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN "destLat" DOUBLE PRECISION,
ADD COLUMN "destLng" DOUBLE PRECISION;
