-- CreateTable
CREATE TABLE "Shipment" (
    "id" SERIAL NOT NULL,
    "tracking" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'GENERADA',
    "clientId" INTEGER,
    "packageType" TEXT NOT NULL DEFAULT 'CAJA',
    "originName" TEXT NOT NULL,
    "originCompany" TEXT NOT NULL DEFAULT '',
    "originEmail" TEXT NOT NULL DEFAULT '',
    "originPhone" TEXT NOT NULL DEFAULT '',
    "originStreet" TEXT NOT NULL,
    "originNumber" TEXT NOT NULL DEFAULT '',
    "originColony" TEXT NOT NULL DEFAULT '',
    "originCity" TEXT NOT NULL DEFAULT '',
    "originState" TEXT NOT NULL DEFAULT '',
    "originZip" TEXT NOT NULL,
    "originRef" TEXT NOT NULL DEFAULT '',
    "originRfc" TEXT NOT NULL DEFAULT '',
    "destName" TEXT NOT NULL,
    "destCompany" TEXT NOT NULL DEFAULT '',
    "destEmail" TEXT NOT NULL DEFAULT '',
    "destPhone" TEXT NOT NULL,
    "destStreet" TEXT NOT NULL,
    "destNumber" TEXT NOT NULL DEFAULT '',
    "destColony" TEXT NOT NULL DEFAULT '',
    "destCity" TEXT NOT NULL DEFAULT '',
    "destState" TEXT NOT NULL DEFAULT '',
    "destZip" TEXT NOT NULL,
    "destRef" TEXT NOT NULL DEFAULT '',
    "borough" TEXT NOT NULL DEFAULT '',
    "zone" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL DEFAULT '',
    "lengthCm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "widthCm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heightCm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packages" INTEGER NOT NULL DEFAULT 1,
    "cod" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceLabel" TEXT NOT NULL DEFAULT '',
    "route" TEXT NOT NULL DEFAULT '',
    "stop" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "by" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipAddress" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DESTINO',
    "alias" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL DEFAULT '',
    "colony" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "zip" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "rfc" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_tracking_key" ON "Shipment"("tracking");
CREATE INDEX "Shipment_createdAt_idx" ON "Shipment"("createdAt");
CREATE INDEX "Shipment_clientId_createdAt_idx" ON "Shipment"("clientId", "createdAt");
CREATE INDEX "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");
CREATE INDEX "ShipAddress_kind_idx" ON "ShipAddress"("kind");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
