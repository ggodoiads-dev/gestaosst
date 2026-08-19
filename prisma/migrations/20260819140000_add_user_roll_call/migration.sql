-- AlterTable
ALTER TABLE "User" ADD COLUMN     "canRollCall" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserRollCallArea" (
    "userId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "UserRollCallArea_pkey" PRIMARY KEY ("userId","areaId")
);

-- CreateTable
CREATE TABLE "UserRollCallTurno" (
    "userId" TEXT NOT NULL,
    "turnoId" TEXT NOT NULL,

    CONSTRAINT "UserRollCallTurno_pkey" PRIMARY KEY ("userId","turnoId")
);

-- AddForeignKey
ALTER TABLE "UserRollCallArea" ADD CONSTRAINT "UserRollCallArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRollCallArea" ADD CONSTRAINT "UserRollCallArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRollCallTurno" ADD CONSTRAINT "UserRollCallTurno_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRollCallTurno" ADD CONSTRAINT "UserRollCallTurno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "Turno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
