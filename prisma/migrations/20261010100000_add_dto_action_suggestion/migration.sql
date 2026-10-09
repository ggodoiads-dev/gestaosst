-- CreateTable
CREATE TABLE "DtoActionSuggestion" (
    "id" TEXT NOT NULL,
    "dtoEvaluationId" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT,

    CONSTRAINT "DtoActionSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DtoActionSuggestion_dtoEvaluationId_key" ON "DtoActionSuggestion"("dtoEvaluationId");

-- AddForeignKey
ALTER TABLE "DtoActionSuggestion" ADD CONSTRAINT "DtoActionSuggestion_dtoEvaluationId_fkey" FOREIGN KEY ("dtoEvaluationId") REFERENCES "DtoEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
