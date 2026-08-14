import {
  ClipboardCheck,
  AlertTriangle,
  FileWarning,
  Lock,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  ShieldCheck,
  Unlock,
  MoveRight,
  UserCog,
  Paperclip,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import type { EquipmentEventType } from "@/generated/prisma/enums";

const EVENT_CONFIG: Record<EquipmentEventType, { label: string; icon: LucideIcon; tone: string }> = {
  EQUIPAMENTO_CADASTRADO: { label: "Equipamento cadastrado", icon: ClipboardCheck, tone: "text-foreground-subtle" },
  CHECKLIST_REALIZADO: { label: "Checklist realizado", icon: ClipboardCheck, tone: "text-info" },
  DESVIO_IDENTIFICADO: { label: "Desvio identificado", icon: AlertTriangle, tone: "text-warning" },
  NC_CRIADA: { label: "Não conformidade criada", icon: FileWarning, tone: "text-danger" },
  EQUIPAMENTO_BLOQUEADO: { label: "Equipamento bloqueado", icon: Lock, tone: "text-danger" },
  EQUIPAMENTO_RESTRITO: { label: "Equipamento restrito", icon: ShieldAlert, tone: "text-warning" },
  MANUTENCAO_INICIADA: { label: "Manutenção iniciada", icon: Wrench, tone: "text-info" },
  MANUTENCAO_CONCLUIDA: { label: "Manutenção concluída", icon: Wrench, tone: "text-success" },
  ACAO_CRIADA: { label: "Ação criada", icon: ClipboardCheck, tone: "text-info" },
  ACAO_CONCLUIDA: { label: "Ação concluída", icon: CheckCircle2, tone: "text-success" },
  CORRECAO_VALIDADA: { label: "Correção validada", icon: ShieldCheck, tone: "text-success" },
  EQUIPAMENTO_LIBERADO: { label: "Equipamento liberado", icon: Unlock, tone: "text-success" },
  MUDANCA_DE_AREA: { label: "Transferido de área", icon: MoveRight, tone: "text-foreground-subtle" },
  MUDANCA_DE_RESPONSAVEL: { label: "Responsável alterado", icon: UserCog, tone: "text-foreground-subtle" },
  DOCUMENTO_ANEXADO: { label: "Documento anexado", icon: Paperclip, tone: "text-foreground-subtle" },
  CHECKLIST_INVALIDADO: { label: "Checklist invalidado", icon: Ban, tone: "text-danger" },
};

export type TimelineEvent = {
  id: string;
  type: EquipmentEventType;
  description: string;
  occurredAt: Date | string;
  user: { name: string } | null;
};

export function EquipmentTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-foreground-subtle">Nenhum evento registrado ainda.</p>;
  }

  return (
    <ol className="flex flex-col">
      {events.map((event, idx) => {
        const cfg = EVENT_CONFIG[event.type];
        const Icon = cfg.icon;
        const isLast = idx === events.length - 1;
        return (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted ${cfg.tone}`}>
                <Icon className="size-3.5" />
              </span>
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className="pb-5">
              <p className="text-sm font-medium text-foreground">{cfg.label}</p>
              <p className="text-xs text-foreground-subtle mt-0.5">{event.description}</p>
              <p className="text-[11px] text-foreground-subtle mt-1">
                {formatDateTime(event.occurredAt)}
                {event.user && <> · {event.user.name}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
