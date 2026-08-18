"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitRollCallAction } from "@/server/actions/attendance-rollcall.actions";
import type { RollCallEntry } from "@/server/services/attendance-rollcall.service";

type AbsenceStatus = "FALTA" | "ATESTADO" | "OUTRO";

const STATUS_OPTIONS: { value: AbsenceStatus; label: string }[] = [
  { value: "FALTA", label: "Falta injustificada" },
  { value: "ATESTADO", label: "Atestado" },
  { value: "OUTRO", label: "Outro" },
];

type RowState = { absent: boolean; status: AbsenceStatus; notes: string };

export function RollCallForm({ entries }: { entries: RollCallEntry[] }) {
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      entries.map((e) => [
        e.collaborator.id,
        {
          absent: e.existingNote !== null,
          status: (e.existingNote?.status as AbsenceStatus) ?? "FALTA",
          notes: e.existingNote?.notes ?? "",
        },
      ]),
    ),
  );
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function update(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function handleSubmit() {
    startTransition(async () => {
      const payload = entries.map((e) => ({
        collaboratorId: e.collaborator.id,
        absent: rows[e.collaborator.id].absent,
        status: rows[e.collaborator.id].status,
        notes: rows[e.collaborator.id].notes,
      }));
      const result = await submitRollCallAction(payload);
      if (result.ok) {
        toast.success("Chamada registrada.");
        setDone(true);
      } else {
        toast.error(result.error);
      }
    });
  }

  const absentCount = Object.values(rows).filter((r) => r.absent).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {entries.map((entry) => {
          const row = rows[entry.collaborator.id];
          return (
            <div key={entry.collaborator.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{entry.collaborator.name}</p>
                  {entry.collaborator.functionName && (
                    <p className="text-xs text-foreground-subtle">{entry.collaborator.functionName}</p>
                  )}
                </div>
                <div className="flex shrink-0 overflow-hidden rounded-md border border-border-strong">
                  <button
                    type="button"
                    onClick={() => update(entry.collaborator.id, { absent: false })}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      !row.absent ? "bg-success-soft text-success" : "bg-surface text-foreground-subtle hover:bg-surface-muted",
                    )}
                  >
                    Presente
                  </button>
                  <button
                    type="button"
                    onClick={() => update(entry.collaborator.id, { absent: true })}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      row.absent ? "bg-danger-soft text-danger" : "bg-surface text-foreground-subtle hover:bg-surface-muted",
                    )}
                  >
                    Falta
                  </button>
                </div>
              </div>

              {row.absent && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  <Select
                    value={row.status}
                    onValueChange={(v) => update(entry.collaborator.id, { status: v as AbsenceStatus })}
                  >
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    rows={2}
                    placeholder="Observação (opcional)"
                    value={row.notes}
                    onChange={(e) => update(entry.collaborator.id, { notes: e.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-foreground-subtle">
          {absentCount === 0 ? "Todo mundo presente." : `${absentCount} falta(s) registrada(s) — vai direto pra escala.`}
        </p>
        <Button onClick={handleSubmit} loading={pending} disabled={done}>
          {done ? "Chamada enviada" : "Registrar chamada"}
        </Button>
      </div>
    </div>
  );
}
