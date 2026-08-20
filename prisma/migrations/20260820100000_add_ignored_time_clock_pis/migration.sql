-- CreateTable
CREATE TABLE "IgnoredTimeClockPis" (
    "pis" TEXT NOT NULL,
    "ignoredById" TEXT NOT NULL,
    "ignoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgnoredTimeClockPis_pkey" PRIMARY KEY ("pis")
);

-- AddForeignKey
ALTER TABLE "IgnoredTimeClockPis" ADD CONSTRAINT "IgnoredTimeClockPis_ignoredById_fkey" FOREIGN KEY ("ignoredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
