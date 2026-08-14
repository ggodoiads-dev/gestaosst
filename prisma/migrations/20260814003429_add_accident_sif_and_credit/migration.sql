-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Accident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "time" TEXT,
    "areaId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "immediateCause" TEXT,
    "rootCause" TEXT,
    "isSif" BOOLEAN NOT NULL DEFAULT false,
    "sifClassification" TEXT,
    "creditNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "investigatedById" TEXT,
    "reportedById" TEXT NOT NULL,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "Accident_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Accident_investigatedById_fkey" FOREIGN KEY ("investigatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Accident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Accident" ("areaId", "closedAt", "code", "date", "description", "id", "immediateCause", "investigatedById", "reportedAt", "reportedById", "rootCause", "severity", "status", "time", "type") SELECT "areaId", "closedAt", "code", "date", "description", "id", "immediateCause", "investigatedById", "reportedAt", "reportedById", "rootCause", "severity", "status", "time", "type" FROM "Accident";
DROP TABLE "Accident";
ALTER TABLE "new_Accident" RENAME TO "Accident";
CREATE UNIQUE INDEX "Accident_code_key" ON "Accident"("code");
CREATE INDEX "Accident_status_idx" ON "Accident"("status");
CREATE INDEX "Accident_date_idx" ON "Accident"("date");
CREATE INDEX "Accident_areaId_idx" ON "Accident"("areaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
