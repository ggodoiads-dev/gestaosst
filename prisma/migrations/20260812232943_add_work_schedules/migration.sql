-- CreateTable
CREATE TABLE "ScheduleType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "workDays" INTEGER NOT NULL,
    "restDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CollaboratorSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collaboratorId" TEXT NOT NULL,
    "scheduleTypeId" TEXT NOT NULL,
    "team" TEXT,
    "startDate" DATETIME NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollaboratorSchedule_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollaboratorSchedule_scheduleTypeId_fkey" FOREIGN KEY ("scheduleTypeId") REFERENCES "ScheduleType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollaboratorSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleDayNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collaboratorId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT,
    "notes" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleDayNote_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleDayNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleType_name_key" ON "ScheduleType"("name");

-- CreateIndex
CREATE INDEX "CollaboratorSchedule_collaboratorId_idx" ON "CollaboratorSchedule"("collaboratorId");

-- CreateIndex
CREATE INDEX "ScheduleDayNote_collaboratorId_idx" ON "ScheduleDayNote"("collaboratorId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDayNote_collaboratorId_date_key" ON "ScheduleDayNote"("collaboratorId", "date");
