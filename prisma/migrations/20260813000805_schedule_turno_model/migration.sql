/*
  Warnings:

  - You are about to drop the `CollaboratorSchedule` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `overrideStatus` to the `ScheduleDayNote` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CollaboratorSchedule_collaboratorId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CollaboratorSchedule";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Turno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "scheduleTypeId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Turno_scheduleTypeId_fkey" FOREIGN KEY ("scheduleTypeId") REFERENCES "ScheduleType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Turno_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Collaborator_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Collaborator_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Collaborator" ("active", "admissionDate", "areaId", "cargo", "createdAt", "id", "matricula", "name", "phone") SELECT "active", "admissionDate", "areaId", "cargo", "createdAt", "id", "matricula", "name", "phone" FROM "Collaborator";
DROP TABLE "Collaborator";
ALTER TABLE "new_Collaborator" RENAME TO "Collaborator";
CREATE UNIQUE INDEX "Collaborator_matricula_key" ON "Collaborator"("matricula");
CREATE INDEX "Collaborator_areaId_idx" ON "Collaborator"("areaId");
CREATE TABLE "new_ScheduleDayNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collaboratorId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "overrideStatus" TEXT NOT NULL,
    "status" TEXT,
    "notes" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleDayNote_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleDayNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleDayNote" ("collaboratorId", "createdAt", "createdById", "date", "id", "notes", "status", "overrideStatus") SELECT "collaboratorId", "createdAt", "createdById", "date", "id", "notes", "status", 'FOLGA' FROM "ScheduleDayNote";
DROP TABLE "ScheduleDayNote";
ALTER TABLE "new_ScheduleDayNote" RENAME TO "ScheduleDayNote";
CREATE INDEX "ScheduleDayNote_collaboratorId_idx" ON "ScheduleDayNote"("collaboratorId");
CREATE UNIQUE INDEX "ScheduleDayNote_collaboratorId_date_key" ON "ScheduleDayNote"("collaboratorId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Turno_name_key" ON "Turno"("name");
