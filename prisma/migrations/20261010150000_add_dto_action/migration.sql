-- CreateTable
CREATE TABLE "DtoAction" (
    "id" TEXT NOT NULL,
    "dtoEvaluationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "ownerRole" TEXT NOT NULL,
    "deadlineLabel" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ActionItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DtoAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DtoAction_dtoEvaluationId_idx" ON "DtoAction"("dtoEvaluationId");

-- CreateIndex
CREATE INDEX "DtoAction_status_idx" ON "DtoAction"("status");

-- CreateIndex
CREATE INDEX "DtoAction_dueDate_idx" ON "DtoAction"("dueDate");

-- AddForeignKey
ALTER TABLE "DtoAction" ADD CONSTRAINT "DtoAction_dtoEvaluationId_fkey" FOREIGN KEY ("dtoEvaluationId") REFERENCES "DtoEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DtoAction" ADD CONSTRAINT "DtoAction_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
