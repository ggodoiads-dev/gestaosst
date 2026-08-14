-- CreateTable
CREATE TABLE "ShiftCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collaboratorId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftCheckIn_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShiftCheckIn_collaboratorId_date_idx" ON "ShiftCheckIn"("collaboratorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftCheckIn_collaboratorId_date_key" ON "ShiftCheckIn"("collaboratorId", "date");
