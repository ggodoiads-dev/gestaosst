import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Criticality } from "@/generated/prisma/enums";

const SEVERITY_TONE: Record<Criticality, "neutral" | "warning" | "danger" | "success"> = {
  BAIXA: "success",
  MEDIA: "neutral",
  ALTA: "warning",
  CRITICA: "danger",
};

const SEVERITY_LABEL: Record<Criticality, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

/** Achado do Copiloto de Inspeção (visão computacional) sobre a foto recém-enviada. */
export function AiFindingCard({
  finding,
}: {
  finding: { severity: Criticality; summary: string; suggestedAction: string | null };
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-accent/30 bg-accent-soft/40 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 shrink-0 text-accent" />
        <span className="font-medium text-foreground">Copiloto de Inspeção</span>
        <Badge tone={SEVERITY_TONE[finding.severity]}>Severidade {SEVERITY_LABEL[finding.severity]}</Badge>
      </div>
      <p className="text-foreground-subtle">{finding.summary}</p>
      {finding.suggestedAction && (
        <p className="text-xs text-foreground-subtle">
          <span className="font-medium">Sugestão:</span> {finding.suggestedAction}
        </p>
      )}
    </div>
  );
}
