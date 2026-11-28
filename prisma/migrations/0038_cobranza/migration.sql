-- Cobranza: seguimiento a clientes con saldo y promesas de pago.
-- CreateTable
CREATE TABLE IF NOT EXISTS "CollectionNote" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTA',
    "note" TEXT NOT NULL DEFAULT '',
    "promiseDate" TEXT NOT NULL DEFAULT '',
    "promiseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CollectionNote_clientId_createdAt_idx" ON "CollectionNote"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "CollectionNote" ADD CONSTRAINT "CollectionNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
