-- CreateTable
CREATE TABLE "JobFunctionRequiredChecklist" (
    "id" TEXT NOT NULL,
    "functionId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobFunctionRequiredChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobFunctionRequiredChecklist_functionId_templateId_key" ON "JobFunctionRequiredChecklist"("functionId", "templateId");

-- CreateIndex
CREATE INDEX "JobFunctionRequiredChecklist_templateId_idx" ON "JobFunctionRequiredChecklist"("templateId");

-- AddForeignKey
ALTER TABLE "JobFunctionRequiredChecklist" ADD CONSTRAINT "JobFunctionRequiredChecklist_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "JobFunction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFunctionRequiredChecklist" ADD CONSTRAINT "JobFunctionRequiredChecklist_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
