-- CreateTable
CREATE TABLE "UserRollCallCollaborator" (
    "userId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,

    CONSTRAINT "UserRollCallCollaborator_pkey" PRIMARY KEY ("userId","collaboratorId")
);

-- CreateIndex
CREATE INDEX "UserRollCallCollaborator_collaboratorId_idx" ON "UserRollCallCollaborator"("collaboratorId");

-- AddForeignKey
ALTER TABLE "UserRollCallCollaborator" ADD CONSTRAINT "UserRollCallCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRollCallCollaborator" ADD CONSTRAINT "UserRollCallCollaborator_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
