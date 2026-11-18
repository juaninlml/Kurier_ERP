-- DropForeignKey
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_clientId_fkey";

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "prospectEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prospectLegalName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prospectName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prospectPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prospectRfc" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "clientId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

