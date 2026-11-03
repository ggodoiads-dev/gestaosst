import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { parseSurvey, type MotivosTempo, type ParsedSurvey, type Satisfacao } from "@/domain/termination/survey";
import { parseSpreadsheet } from "@/lib/spreadsheet-import";

const RH = PERMISSIONS.HR_MANAGE;

export type ExitSurveyView = {
  motivos: { periodLabel: string | null; updatedAt: Date; data: MotivosTempo } | null;
  satisfacao: { periodLabel: string | null; updatedAt: Date; data: Satisfacao } | null;
};

/** Lê o que está guardado. Tolera a tabela ainda não existir (volta vazio). */
export async function getExitSurvey(): Promise<ExitSurveyView> {
  const out: ExitSurveyView = { motivos: null, satisfacao: null };
  try {
    const rows = await db.exitSurveySummary.findMany();
    for (const r of rows) {
      const item = { periodLabel: r.periodLabel, updatedAt: r.updatedAt, data: r.data };
      if (r.kind === "MOTIVOS_TEMPO") out.motivos = item as ExitSurveyView["motivos"];
      if (r.kind === "SATISFACAO") out.satisfacao = item as ExitSurveyView["satisfacao"];
    }
  } catch (error) {
    console.error("[exit-survey] tabela indisponível:", error);
  }
  return out;
}

export async function readSurveyFile(user: CurrentUser, buffer: Buffer, filename: string): Promise<ParsedSurvey | { error: string }> {
  requirePermission(user, RH);
  const { headers, rows } = await parseSpreadsheet(buffer, filename);
  if (headers.length === 0) return { error: "Não consegui ler nenhuma coluna nesse arquivo." };
  return parseSurvey(headers, rows);
}

export async function saveExitSurvey(user: CurrentUser, survey: ParsedSurvey, periodLabel: string) {
  requirePermission(user, RH);
  if (survey.kind !== "MOTIVOS_TEMPO" && survey.kind !== "SATISFACAO") throw new Error("Tipo de tabela inválido.");
  const label = periodLabel.trim().slice(0, 80) || null;
  const data = JSON.parse(JSON.stringify(survey.data));
  await db.exitSurveySummary.upsert({
    where: { kind: survey.kind },
    create: { kind: survey.kind, periodLabel: label, data, updatedById: user.id },
    update: { periodLabel: label, data, updatedById: user.id },
  });
  await recordAudit({ userId: user.id, action: "UPDATE", entityType: "ExitSurveySummary", entityId: survey.kind, newValue: { periodLabel: label } });
}

export async function clearExitSurvey(user: CurrentUser, kind: "MOTIVOS_TEMPO" | "SATISFACAO") {
  requirePermission(user, RH);
  await db.exitSurveySummary.deleteMany({ where: { kind } });
  await recordAudit({ userId: user.id, action: "DELETE", entityType: "ExitSurveySummary", entityId: kind });
}
