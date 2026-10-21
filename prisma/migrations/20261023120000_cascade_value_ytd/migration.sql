-- AlterTable
ALTER TABLE "CascadeValue" ADD COLUMN IF NOT EXISTS "ytd" DOUBLE PRECISION;
ALTER TABLE "CascadeValue" ALTER COLUMN "value" DROP NOT NULL;
-- Os resultados importados da planilha eram o acumulado do ano (YTD set/2026): passam para a coluna certa.
UPDATE "CascadeValue" SET "ytd" = "value", "value" = NULL WHERE "source" = 'IMPORT' AND "ytd" IS NULL;
-- O IC de DTO passa a ler o resultado do MÊS (o acumulado do ano o SIGO soma sozinho).
UPDATE "CascadeNode" SET "sigoKey" = 'dto.month.count' WHERE "seedKey" = 'ic:dto-dmpeople' AND "sigoKey" = 'dto.year.count';
