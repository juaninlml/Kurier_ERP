-- Orden de entrega: número de parada de cada guía dentro de su carga (se calcula al cerrar la carga).
ALTER TABLE "Shipment" ADD COLUMN "routeSeq" INTEGER;
