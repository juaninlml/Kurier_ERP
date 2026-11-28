-- Novedades del ERP: id de la última novedad que vio cada usuario (src/lib/changelog.ts).
-- Los usuarios existentes quedan en "" y verán las novedades publicadas al volver a entrar.
-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSeenChangelog" TEXT NOT NULL DEFAULT '';
