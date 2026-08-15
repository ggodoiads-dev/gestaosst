"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TurnoSelectDialog } from "./turno-select-dialog";
import { ScheduleDayNoteDialog } from "./schedule-day-note-dialog";
import type { ScheduleType, Turno } from "@/generated/prisma/client";

type DayCellData = {
  date: string; // yyyy-mm-dd
  day: number;
  weekday: string;
  computed: "TRABALHO" | "FOLGA";
  note: {
    id: string;
    status: string | null;
    notes: string;
    overrideStatus: string;
    attachments: { id: string; filename: string; path: string }[];
  } | null;
};

type RowData = {
  collaborator: { id: string; name: string; turnoId: string | null; functionId: string | null };
  functionName: string | null;
  turnoLabel: string | null;
  days: DayCellData[];
};

const STATUS_LABEL: Record<string, string> = {
  FALTA: "Falta",
  ATESTADO: "Atest.",
  FERIAS: "Férias",
  TROCA: "Troca",
  OUTRO: "Obs.",
};

export function ScheduleGridClient({
  rows,
  turnos,
  functions,
}: {
  rows: RowData[];
  turnos: (Turno & { scheduleType: ScheduleType })[];
  functions: { id: string; name: string }[];
}) {
  const [selectedCell, setSelectedCell] = useState<{
    collaboratorId: string;
    collaboratorName: string;
    date: string;
    computed: "TRABALHO" | "FOLGA";
    note: DayCellData["note"];
  } | null>(null);
  const [turnoFor, setTurnoFor] = useState<{ id: string; name: string; turnoId: string | null } | null>(null);
  const [functionFilter, setFunctionFilter] = useState("all");
  const [turnoFilter, setTurnoFilter] = useState("all");

  const turnosForFilter =
    functionFilter === "all"
      ? turnos
      : turnos.filter((t) => rows.some((r) => r.collaborator.functionId === functionFilter && r.collaborator.turnoId === t.id));

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (functionFilter !== "all" && r.collaborator.functionId !== functionFilter) return false;
        if (turnoFilter !== "all" && r.collaborator.turnoId !== turnoFilter) return false;
        return true;
      }),
    [rows, functionFilter, turnoFilter],
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <FormField label="Função">
            <Select
              value={functionFilter}
              onValueChange={(v) => {
                setFunctionFilter(v);
                setTurnoFilter("all");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                {functions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="w-52">
          <FormField label="Turno">
            <Select value={turnoFilter} onValueChange={setTurnoFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                {turnosForFilter.map((t) => (
                  <SelectItem key={t.id} value={t.id}>Turno {t.name} ({t.scheduleType.name})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              <th className="sticky left-0 z-10 bg-surface-muted px-3 py-2 text-left text-xs font-semibold text-foreground-subtle whitespace-nowrap">
                Colaborador
              </th>
              {(filteredRows[0] ?? rows[0])?.days.map((d) => (
                <th key={d.date} className="px-1.5 py-1 text-center text-[11px] font-medium text-foreground-subtle">
                  <div>{d.day}</div>
                  <div className="font-normal text-foreground-subtle/70">{d.weekday}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={(rows[0]?.days.length ?? 0) + 1} className="px-3 py-8 text-center text-sm text-foreground-subtle">
                  Nenhum colaborador com esses filtros.
                </td>
              </tr>
            )}
            {filteredRows.map((row) => (
              <tr key={row.collaborator.id} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-surface px-3 py-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => setTurnoFor(row.collaborator)}
                  >
                    <p className="font-medium text-foreground hover:underline">{row.collaborator.name}</p>
                    <p className="text-xs text-foreground-subtle">
                      {row.functionName ? `${row.functionName} · ` : ""}
                      {row.turnoLabel ?? "Sem turno definido"}
                    </p>
                  </button>
                </td>
                {row.days.map((d) => {
                  const label = d.note ? (STATUS_LABEL[d.note.status ?? "OUTRO"] ?? "Obs.") : d.computed === "TRABALHO" ? "T" : "F";
                  return (
                    <td key={d.date} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        title={d.note?.notes}
                        onClick={() =>
                          setSelectedCell({
                            collaboratorId: row.collaborator.id,
                            collaboratorName: row.collaborator.name,
                            date: d.date,
                            computed: d.computed,
                            note: d.note,
                          })
                        }
                        className={cn(
                          "mx-auto flex h-7 w-9 items-center justify-center rounded text-[10px] font-semibold transition-opacity hover:opacity-75",
                          d.note
                            ? "bg-warning-soft text-warning"
                            : d.computed === "TRABALHO"
                              ? "bg-success-soft text-success"
                              : "bg-neutral-soft text-foreground-muted",
                        )}
                      >
                        {label}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <ScheduleDayNoteDialog
          collaboratorId={selectedCell.collaboratorId}
          collaboratorName={selectedCell.collaboratorName}
          date={selectedCell.date}
          computed={selectedCell.computed}
          note={selectedCell.note}
          onClose={() => setSelectedCell(null)}
        />
      )}

      {turnoFor && (
        <TurnoSelectDialog
          collaboratorId={turnoFor.id}
          collaboratorName={turnoFor.name}
          currentTurnoId={turnoFor.turnoId}
          turnos={turnos}
          onClose={() => setTurnoFor(null)}
        />
      )}
    </>
  );
}
