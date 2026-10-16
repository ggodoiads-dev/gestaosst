-- CreateTable
CREATE TABLE "ActivityArea" (
    "activityId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "ActivityArea_pkey" PRIMARY KEY ("activityId","areaId")
);

-- CreateIndex
CREATE INDEX "ActivityArea_areaId_idx" ON "ActivityArea"("areaId");

-- AddForeignKey
ALTER TABLE "ActivityArea" ADD CONSTRAINT "ActivityArea_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityArea" ADD CONSTRAINT "ActivityArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;
