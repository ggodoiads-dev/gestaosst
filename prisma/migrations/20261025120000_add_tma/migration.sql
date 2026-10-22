-- CreateTable
CREATE TABLE IF NOT EXISTS "TmaImport" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" TEXT NOT NULL,
    CONSTRAINT "TmaImport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "TmaTruck" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "gradeDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "presentation" TEXT,
    "destino" TEXT,
    "tipoCarro" TEXT,
    "pedido" TEXT,
    "placas" TEXT,
    "motorista" TEXT,
    "transportadora" TEXT,
    "conferente" TEXT,
    "turno" TEXT,
    "checklist" TEXT,
    "agendamento" TIMESTAMP(3),
    "apresentacao" TIMESTAMP(3),
    "entradaAtendimento" TIMESTAMP(3),
    "entradaBaia" TIMESTAMP(3),
    "inicioCarregamento" TIMESTAMP(3),
    "fimCarregamento" TIMESTAMP(3),
    "fimAmarracao" TIMESTAMP(3),
    "liberacao" TIMESTAMP(3),
    "tmaMin" DOUBLE PRECISION,
    "atendimentoMin" DOUBLE PRECISION,
    "patioMin" DOUBLE PRECISION,
    "esperaMin" DOUBLE PRECISION,
    "tmcMin" DOUBLE PRECISION,
    "amarracaoMin" DOUBLE PRECISION,
    "liberacaoMin" DOUBLE PRECISION,
    CONSTRAINT "TmaTruck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TmaTruck_periodKey_idx" ON "TmaTruck"("periodKey");
ALTER TABLE "TmaImport" ADD CONSTRAINT "TmaImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TmaTruck" ADD CONSTRAINT "TmaTruck_importId_fkey" FOREIGN KEY ("importId") REFERENCES "TmaImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
