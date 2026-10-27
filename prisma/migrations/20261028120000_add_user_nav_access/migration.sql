-- CreateTable
CREATE TABLE IF NOT EXISTS "UserNavAccess" (
    "userId" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    CONSTRAINT "UserNavAccess_pkey" PRIMARY KEY ("userId","href")
);
CREATE INDEX IF NOT EXISTS "UserNavAccess_userId_idx" ON "UserNavAccess"("userId");
