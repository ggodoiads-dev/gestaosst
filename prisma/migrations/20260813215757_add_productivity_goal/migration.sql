-- CreateTable
CREATE TABLE "ProductivityGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collaboratorId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductivityGoal_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductivityGoal_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductivityGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductivityGoal_month_year_idx" ON "ProductivityGoal"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ProductivityGoal_collaboratorId_activityId_month_year_key" ON "ProductivityGoal"("collaboratorId", "activityId", "month", "year");
