-- CreateTable
CREATE TABLE "AiInspectionFinding" (
    "id" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "severity" "Criticality" NOT NULL,
    "summary" TEXT NOT NULL,
    "suggestedAction" TEXT,
    "model" TEXT NOT NULL,
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInspectionFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiInspectionFinding_attachmentId_key" ON "AiInspectionFinding"("attachmentId");

-- CreateIndex
CREATE INDEX "AiInspectionFinding_severity_idx" ON "AiInspectionFinding"("severity");

-- AddForeignKey
ALTER TABLE "AiInspectionFinding" ADD CONSTRAINT "AiInspectionFinding_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
