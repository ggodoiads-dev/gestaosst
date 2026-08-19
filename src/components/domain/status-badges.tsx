import { Badge } from "@/components/ui/badge";
import type {
  EquipmentStatus,
  Criticality,
  NonconformityStatus,
  ActionItemStatus,
  ExecutionStatus,
  TemplateStatus,
  VersionStatus,
  AccidentStatus,
  AccidentActionStatus,
} from "@/generated/prisma/enums";

const EQUIPMENT_STATUS_MAP: Record<EquipmentStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  LIBERADO: { label: "Liberado", tone: "success" },
  LIBERADO_COM_OBSERVACAO: { label: "Liberado c/ observação", tone: "info" },
  RESTRITO: { label: "Restrito", tone: "warning" },
  BLOQUEADO: { label: "Bloqueado", tone: "danger" },
  EM_MANUTENCAO: { label: "Em manutenção", tone: "warning" },
  INATIVO: { label: "Inativo", tone: "neutral" },
};

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  const cfg = EQUIPMENT_STATUS_MAP[status];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}

const CRITICALITY_MAP: Record<Criticality, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  BAIXA: { label: "Baixa", tone: "neutral" },
  MEDIA: { label: "Média", tone: "info" },
  ALTA: { label: "Alta", tone: "warning" },
  CRITICA: { label: "Crítica", tone: "danger" },
};

export function CriticalityBadge({ value }: { value: Criticality }) {
  const cfg = CRITICALITY_MAP[value];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

const NC_STATUS_MAP: Record<NonconformityStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  ABERTA: { label: "Aberta", tone: "danger" },
  EM_ANALISE: { label: "Em análise", tone: "warning" },
  ACAO_DEFINIDA: { label: "Ação definida", tone: "info" },
  EM_EXECUCAO: { label: "Em execução", tone: "info" },
  AGUARDANDO_VERIFICACAO: { label: "Aguardando verificação", tone: "warning" },
  CONCLUIDA: { label: "Concluída", tone: "success" },
  ENCERRADA: { label: "Encerrada", tone: "success" },
  CANCELADA: { label: "Cancelada", tone: "neutral" },
};

export function NonconformityStatusBadge({ status }: { status: NonconformityStatus }) {
  const cfg = NC_STATUS_MAP[status];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}

const ACTION_STATUS_MAP: Record<ActionItemStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDENTE: { label: "Pendente", tone: "neutral" },
  EM_ANDAMENTO: { label: "Em andamento", tone: "info" },
  CONCLUIDA: { label: "Concluída", tone: "success" },
  VENCIDA: { label: "Vencida", tone: "danger" },
  CANCELADA: { label: "Cancelada", tone: "neutral" },
};

export function ActionItemStatusBadge({ status }: { status: ActionItemStatus }) {
  const cfg = ACTION_STATUS_MAP[status];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}

const EXECUTION_STATUS_MAP: Record<ExecutionStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  EM_ANDAMENTO: { label: "Em andamento", tone: "info" },
  CONCLUIDO: { label: "Concluído", tone: "success" },
  INVALIDADO: { label: "Invalidado", tone: "neutral" },
};

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  const cfg = EXECUTION_STATUS_MAP[status];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}

const TEMPLATE_STATUS_MAP: Record<TemplateStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  RASCUNHO: { label: "Rascunho", tone: "neutral" },
  PUBLICADO: { label: "Publicado", tone: "success" },
  ARQUIVADO: { label: "Arquivado", tone: "neutral" },
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  const cfg = TEMPLATE_STATUS_MAP[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

const VERSION_STATUS_MAP: Record<VersionStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  RASCUNHO: { label: "Rascunho", tone: "neutral" },
  ATIVA: { label: "Ativa", tone: "success" },
  RETIRADA: { label: "Retirada", tone: "neutral" },
};

export function VersionStatusBadge({ status }: { status: VersionStatus }) {
  const cfg = VERSION_STATUS_MAP[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

const ACCIDENT_STATUS_MAP: Record<AccidentStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  ABERTO: { label: "Aberto", tone: "danger" },
  EM_INVESTIGACAO: { label: "Em investigação", tone: "warning" },
  CONCLUIDO: { label: "Concluído", tone: "success" },
  CANCELADA: { label: "Cancelado", tone: "neutral" },
};

export function AccidentStatusBadge({ status }: { status: AccidentStatus }) {
  const cfg = ACCIDENT_STATUS_MAP[status];
  return (
    <Badge tone={cfg.tone} dot>
      {cfg.label}
    </Badge>
  );
}

const ACCIDENT_ACTION_STATUS_MAP: Record<AccidentActionStatus, { label: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  PENDENTE: { label: "Pendente", tone: "neutral" },
  EM_ANDAMENTO: { label: "Em andamento", tone: "info" },
  CONCLUIDA: { label: "Concluída", tone: "success" },
  CANCELADA: { label: "Cancelada", tone: "neutral" },
};

export function AccidentActionStatusBadge({ status }: { status: AccidentActionStatus }) {
  const cfg = ACCIDENT_ACTION_STATUS_MAP[status];
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}
