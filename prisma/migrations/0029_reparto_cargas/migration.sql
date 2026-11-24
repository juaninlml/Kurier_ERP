-- Reparto por almacenamiento: el repartidor escanea el almacenamiento del transporte, luego los paquetes,
-- cierra la carga y la app queda solo en entrega hasta terminar la ruta.

-- CreateTable
CREATE TABLE "StorageUnit" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteLoad" (
    "id" SERIAL NOT NULL,
    "storageId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "driverName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'CARGANDO',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "finishedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RouteLoad_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "loadId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "StorageUnit_code_key" ON "StorageUnit"("code");

-- CreateIndex
CREATE INDEX "RouteLoad_driverId_status_idx" ON "RouteLoad"("driverId", "status");

-- CreateIndex
CREATE INDEX "RouteLoad_storageId_status_idx" ON "RouteLoad"("storageId", "status");

-- CreateIndex
CREATE INDEX "Shipment_loadId_idx" ON "Shipment"("loadId");

-- AddForeignKey
ALTER TABLE "RouteLoad" ADD CONSTRAINT "RouteLoad_storageId_fkey" FOREIGN KEY ("storageId") REFERENCES "StorageUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_loadId_fkey" FOREIGN KEY ("loadId") REFERENCES "RouteLoad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
