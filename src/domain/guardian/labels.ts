import type { GuardianReportType } from "@/generated/prisma/enums";

/** Percentual de cada tipo de relato sobre o total de relatos do mês (1 casa). Mostra todos os tipos, inclusive os com zero. */
export function guardianTypeShares(byType: { type: GuardianReportType; count: number }[]): { type: GuardianReportType; label: string; count: number; pct: number }[] {
  const total = byType.reduce((s, t) => s + t.count, 0);
  return (Object.keys(GUARDIAN_TYPE_LABELS) as GuardianReportType[]).map((type) => {
    const count = byType.find((t) => t.type === type)?.count ?? 0;
    return { type, label: GUARDIAN_TYPE_LABELS[type], count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 };
  });
}

export const GUARDIAN_TYPE_LABELS: Record<GuardianReportType, string> = {
  COMPORTAMENTO_RISCO: "Comportamento de risco",
  CONDICAO: "Condição insegura",
  INCIDENTE: "Incidente",
  RECONHECIMENTO: "Reconhecimento",
};
