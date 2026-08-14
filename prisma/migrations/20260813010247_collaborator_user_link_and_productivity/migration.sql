-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "unit" TEXT;

-- CreateTable
CREATE TABLE "ProductivityEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collaboratorId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "activityId" TEXT NOT NULL,
    "quantity" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductivityEntry_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductivityEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductivityEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Collaborator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "matricula" TEXT,
    "cargo" TEXT,
    "admissionDate" DATETIME,
    "areaId" TEXT,
    "turnoId" TEXT,
    "phone" TEXT,
    "checklistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Collaborator_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Collaborator_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Collaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Collaborator" ("active", "admissionDate", "areaId", "cargo", "createdAt", "id", "matricula", "name", "phone", "turnoId") SELECT "active", "admissionDate", "areaId", "cargo", "createdAt", "id", "matricula", "name", "phone", "turnoId" FROM "Collaborator";
DROP TABLE "Collaborator";
ALTER TABLE "new_Collaborator" RENAME TO "Collaborator";
CREATE UNIQUE INDEX "Collaborator_matricula_key" ON "Collaborator"("matricula");
CREATE UNIQUE INDEX "Collaborator_userId_key" ON "Collaborator"("userId");
CREATE INDEX "Collaborator_areaId_idx" ON "Collaborator"("areaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProductivityEntry_collaboratorId_date_idx" ON "ProductivityEntry"("collaboratorId", "date");

-- CreateIndex
CREATE INDEX "ProductivityEntry_activityId_idx" ON "ProductivityEntry"("activityId");
