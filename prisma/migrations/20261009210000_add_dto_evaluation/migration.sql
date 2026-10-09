-- CreateTable
CREATE TABLE "DtoEvaluation" (
    "id" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "evaluatedName" TEXT NOT NULL,
    "evaluatedRole" TEXT,
    "evaluatorName" TEXT,
    "evaluatorRole" TEXT,
    "leaderName" TEXT,
    "company" TEXT,
    "operation" TEXT,
    "activity" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "yesCount" INTEGER NOT NULL DEFAULT 0,
    "noCount" INTEGER NOT NULL DEFAULT 0,
    "naCount" INTEGER NOT NULL DEFAULT 0,
    "scorePercent" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,

    CONSTRAINT "DtoEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DtoEvaluation_externalKey_key" ON "DtoEvaluation"("externalKey");

-- CreateIndex
CREATE INDEX "DtoEvaluation_collaboratorId_idx" ON "DtoEvaluation"("collaboratorId");

-- CreateIndex
CREATE INDEX "DtoEvaluation_date_idx" ON "DtoEvaluation"("date");

-- AddForeignKey
ALTER TABLE "DtoEvaluation" ADD CONSTRAINT "DtoEvaluation_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DtoEvaluation" ADD CONSTRAINT "DtoEvaluation_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
