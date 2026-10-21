-- CreateTable
CREATE TABLE IF NOT EXISTS "DreImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "unit" TEXT,
    "officialAt" TEXT,
    "months" TEXT[],
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,
    CONSTRAINT "DreImport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "DreLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "remunerado" DOUBLE PRECISION NOT NULL,
    "realizado" DOUBLE PRECISION NOT NULL,
    "diferenca" DOUBLE PRECISION NOT NULL,
    "avr" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "DreLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DreLine_periodKey_code_key" ON "DreLine"("periodKey", "code");
CREATE INDEX IF NOT EXISTS "DreLine_periodKey_idx" ON "DreLine"("periodKey");
ALTER TABLE "DreImport" ADD CONSTRAINT "DreImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DreLine" ADD CONSTRAINT "DreLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "DreImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
