-- CreateEnum
CREATE TYPE "AbsenceInterviewStatus" AS ENUM ('SOLICITADA', 'RESPONDIDA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "AbsenceClassification" AS ENUM ('JUSTIFICADA', 'NAO_JUSTIFICADA', 'PREVISTA_LEI');

-- CreateTable
CREATE TABLE "AbsenceInterview" (
    "id" TEXT NOT NULL,
    "scheduleDayNoteId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "status" "AbsenceInterviewStatus" NOT NULL DEFAULT 'SOLICITADA',
    "answers" JSONB,
    "filledByHr" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),
    "answeredById" TEXT,
    "classification" "AbsenceClassification",
    "actionTaken" TEXT,
    "evaluation" JSONB,
    "concludedAt" TIMESTAMP(3),
    "concludedById" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceInterview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceInterview_scheduleDayNoteId_key" ON "AbsenceInterview"("scheduleDayNoteId");

-- CreateIndex
CREATE INDEX "AbsenceInterview_collaboratorId_idx" ON "AbsenceInterview"("collaboratorId");

-- CreateIndex
CREATE INDEX "AbsenceInterview_status_idx" ON "AbsenceInterview"("status");

-- AddForeignKey
ALTER TABLE "AbsenceInterview" ADD CONSTRAINT "AbsenceInterview_scheduleDayNoteId_fkey" FOREIGN KEY ("scheduleDayNoteId") REFERENCES "ScheduleDayNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceInterview" ADD CONSTRAINT "AbsenceInterview_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceInterview" ADD CONSTRAINT "AbsenceInterview_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceInterview" ADD CONSTRAINT "AbsenceInterview_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceInterview" ADD CONSTRAINT "AbsenceInterview_concludedById_fkey" FOREIGN KEY ("concludedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
