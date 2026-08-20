-- AlterTable
ALTER TABLE "QualificationType" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
