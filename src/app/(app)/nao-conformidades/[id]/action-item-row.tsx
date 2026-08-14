"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ActionItemStatusBadge } from "@/components/domain/status-badges";
import { completeActionItemAction, validateActionItemAction } from "@/server/actions/nonconformity.actions";
import { formatDate, formatDateTime } from "@/lib/dates";

type ActionItemData = {
  id: string;
  description: string;
  responsible: { name: string };
  dueDate: string | Date;
  priority: string;
  status: string;
  notes: string | null;
  completedAt: string | Date | null;
  completedBy: { name: string } | null;
  validatedAt: string | Date | null;
  validatedBy: { name: string } | null;
};

export function ActionItemRow({
  item,
  nonconformityId,
  equipmentId,
  canValidate,
}: {
  item: ActionItemData;
  nonconformityId: string;
  equipmentId: string;
  canValidate: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleComplete() {
    startTransition(async () => {
      await completeActionItemAction(nonconformityId, item.id, notes);
      toast.success("Ação marcada como concluída.");
    });
  }

  function handleValidate() {
    startTransition(async () => {
      await validateActionItemAction(nonconformityId, item.id, equipmentId);
      toast.success("Correção validada.");
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-foreground">{item.description}</p>
        <ActionItemStatusBadge status={item.status as never} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-subtle">
        <span>Responsável: {item.responsible.name}</span>
        <span>·</span>
        <span>Prazo: {formatDate(item.dueDate)}</span>
        <span>·</span>
        <Badge tone="neutral">{item.priority}</Badge>
      </div>

      {item.status === "PENDENTE" && (
        <div className="flex flex-col gap-2 pt-1">
          <Textarea
            rows={2}
            placeholder="Observações sobre a correção realizada (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button size="sm" className="self-start" onClick={handleComplete} loading={isPending}>
            <CheckCircle2 /> Marcar como concluída
          </Button>
        </div>
      )}

      {item.status === "CONCLUIDA" && (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-xs text-foreground-subtle">
            Concluída por {item.completedBy?.name} em {formatDateTime(item.completedAt)}.
            {item.notes && <> Observação: {item.notes}</>}
          </p>
          {canValidate && (
            <Button size="sm" className="self-start" onClick={handleValidate} loading={isPending}>
              <ShieldCheck /> Validar correção e liberar equipamento
            </Button>
          )}
        </div>
      )}

      {item.validatedAt && (
        <p className="text-xs text-success">
          Validada por {item.validatedBy?.name} em {formatDateTime(item.validatedAt)}.
        </p>
      )}
    </div>
  );
}
