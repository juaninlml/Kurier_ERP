-- CreateTable
CREATE TABLE "DriveFile" (
    "id" SERIAL NOT NULL,
    "refKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileId" TEXT NOT NULL DEFAULT '',
    "folderId" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveFile_refKey_key" ON "DriveFile"("refKey");

-- CreateIndex
CREATE INDEX "DriveFile_kind_idx" ON "DriveFile"("kind");
