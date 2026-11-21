-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "PayrollLine" ADD COLUMN     "payMethod" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidBy" TEXT NOT NULL DEFAULT '';

-- Las nóminas que ya estaban pagadas quedan con todos sus empleados pagados
UPDATE "PayrollLine" l SET "paidAt" = r."updatedAt", "paidBy" = 'Registro anterior'
FROM "PayrollRun" r WHERE l."runId" = r."id" AND r."status" = 'PAGADA';
