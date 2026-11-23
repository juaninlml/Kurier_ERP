-- Reparto: carga al vehículo, intentos y entrega con firma y foto
ALTER TABLE "Shipment" ADD COLUMN "loadedAt" TIMESTAMP(3),
ADD COLUMN "loadedBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "receiverName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "deliveredBy" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ShipmentProof" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "signature" BYTEA NOT NULL,
    "signatureMime" TEXT NOT NULL DEFAULT 'image/png',
    "photo" BYTEA NOT NULL,
    "photoMime" TEXT NOT NULL DEFAULT 'image/jpeg',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentProof_shipmentId_key" ON "ShipmentProof"("shipmentId");

-- AddForeignKey
ALTER TABLE "ShipmentProof" ADD CONSTRAINT "ShipmentProof_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
