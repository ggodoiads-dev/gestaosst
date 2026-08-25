import type { GuardianReportType } from "@/generated/prisma/enums";

export const GUARDIAN_TYPE_LABELS: Record<GuardianReportType, string> = {
  COMPORTAMENTO_RISCO: "Comportamento de risco",
  CONDICAO: "Condição insegura",
  INCIDENTE: "Incidente",
  RECONHECIMENTO: "Reconhecimento",
};
