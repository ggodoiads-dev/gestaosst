-- CreateTable
CREATE TABLE "JobFunction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "JobFunctionEpiKitItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobFunctionId" TEXT NOT NULL,
    "epiTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "JobFunctionEpiKitItem_jobFunctionId_fkey" FOREIGN KEY ("jobFunctionId") REFERENCES "JobFunction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "JobFunctionEpiKitItem_epiTypeId_fkey" FOREIGN KEY ("epiTypeId") REFERENCES "EpiType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EpiType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultCa" TEXT,
    "validityMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EpiDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collaboratorId" TEXT NOT NULL,
    "epiTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "ca" TEXT,
    "size" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'PRIMEIRA_ENTREGA',
    "deliveredAt" DATETIME NOT NULL,
    "returnedAt" DATETIME,
    "traceable" BOOLEAN NOT NULL DEFAULT false,
    "qrToken" TEXT,
    "code" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EpiDelivery_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EpiDelivery_epiTypeId_fkey" FOREIGN KEY ("epiTypeId") REFERENCES "EpiType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EpiDelivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Collaborator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "matricula" TEXT,
    "cargo" TEXT,
    "functionId" TEXT,
    "cpf" TEXT,
    "ctps" TEXT,
    "ctpsSerie" TEXT,
    "admissionDate" DATETIME,
    "inactivatedAt" DATETIME,
    "areaId" TEXT,
    "turnoId" TEXT,
    "phone" TEXT,
    "checklistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Collaborator_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Collaborator_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Collaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Collaborator_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "JobFunction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Collaborator" ("active", "admissionDate", "areaId", "cargo", "checklistEnabled", "createdAt", "id", "matricula", "name", "phone", "turnoId", "userId") SELECT "active", "admissionDate", "areaId", "cargo", "checklistEnabled", "createdAt", "id", "matricula", "name", "phone", "turnoId", "userId" FROM "Collaborator";
DROP TABLE "Collaborator";
ALTER TABLE "new_Collaborator" RENAME TO "Collaborator";
CREATE UNIQUE INDEX "Collaborator_matricula_key" ON "Collaborator"("matricula");
CREATE UNIQUE INDEX "Collaborator_userId_key" ON "Collaborator"("userId");
CREATE INDEX "Collaborator_areaId_idx" ON "Collaborator"("areaId");
CREATE INDEX "Collaborator_functionId_idx" ON "Collaborator"("functionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "JobFunction_name_key" ON "JobFunction"("name");

-- CreateIndex
CREATE INDEX "JobFunctionEpiKitItem_epiTypeId_idx" ON "JobFunctionEpiKitItem"("epiTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "JobFunctionEpiKitItem_jobFunctionId_epiTypeId_key" ON "JobFunctionEpiKitItem"("jobFunctionId", "epiTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "EpiType_name_key" ON "EpiType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EpiDelivery_qrToken_key" ON "EpiDelivery"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "EpiDelivery_code_key" ON "EpiDelivery"("code");

-- CreateIndex
CREATE INDEX "EpiDelivery_collaboratorId_idx" ON "EpiDelivery"("collaboratorId");

-- CreateIndex
CREATE INDEX "EpiDelivery_epiTypeId_idx" ON "EpiDelivery"("epiTypeId");
