-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_createdById_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLogins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totpSecret" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'INVITE',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pendingSecret" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

