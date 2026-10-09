"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActionItemStatusBadge } from "@/components/domain/status-badges";
import { formatDate } from "@/lib/dates";
import { formatPersonName } from "@/lib/format-name";
import { setDtoActionStatusAction } from "@/server/actions/dto-action.actions";
import type { DtoActionRow } from "@/server/services/dto-action.service";

type Filter = "abertas" | "concluidas" | "todas";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function StatusButtons({ id, status }: { id: string; status: DtoActionRow["status"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function set(next: DtoActionRow["status"]) {
    startTransition(async () => {
      const res = await setDtoActionStatusAction(id, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }
  if (status === "CONCLUIDA" || status === "CANCELADA") {
    return (
      <Button size="sm" variant="ghost" loading={pending} onClick={() => set("PENDENTE")}>
        Reabrir
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {status === "PENDENTE" && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => set("EM_ANDAMENTO")}>
          Iniciar
        </Button>
      )}
      <Button size="sm" loading={pending} onClick={() => set("CONCLUIDA")}>
        Concluir
      </Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => set("CANCELADA")}>
        Cancelar
      </Button>
    </div>
  );
}

/** Ações corretivas dos DTOs (sugeridas pelo Rico) com prazo e status. `canManage` = quem pode mudar o status. */
export function DtoActionsTable({ rows, canManage }: { rows: DtoActionRow[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("abertas");
  const now = new Date();

  const open = rows.filter((r) => r.status !== "CONCLUIDA" && r.status !== "CANCELADA");
  const overdue = open.filter((r) => new Date(r.dueDate) < now).length;
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === "todas" || (filter === "abertas" ? r.status !== "CONCLUIDA" && r.status !== "CANCELADA" : r.status === "CONCLUIDA")) &&
          (!query || normalize(r.collaboratorName).includes(normalize(query)) || normalize(r.title).includes(normalize(query))),
      ),
    [rows, filter, query],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar colaborador ou ação..."
            className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm text-foreground"
          />
        </div>
        <div className="flex overflow-hidden rounded-md border border-border-strong">
          {(
            [
              ["abertas", `Abertas (${open.length})`],
              ["concluidas", "Concluídas"],
              ["todas", "Todas"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium",
                filter === key ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-subtle hover:bg-surface-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {overdue > 0 && <span className="text-xs font-medium text-danger">{overdue} vencida(s)</span>}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
          {rows.length === 0
            ? "Nenhuma ação de DTO ainda. Elas nascem das sugestões do Rico para os pontos negativos de cada DTO."
            : "Nenhuma ação com esse filtro."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((r) => {
            const isOverdue = r.status !== "CONCLUIDA" && r.status !== "CANCELADA" && new Date(r.dueDate) < now;
            return (
              <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{r.title}</p>
                  <p className="mt-0.5 text-sm text-foreground-muted">{r.detail}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-foreground-subtle">
                    <Link href={`/dto`} className="hover:underline">
                      DTO de {formatPersonName(r.collaboratorName)} — {r.activity} ({formatDate(r.dtoDate)})
                    </Link>
                    <span>·</span>
                    <span>Responsável: {r.ownerRole}</span>
                    <span>·</span>
                    <span className={cn(isOverdue && "font-medium text-danger")}>Prazo: {formatDate(r.dueDate)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  {isOverdue ? <span className="text-xs font-semibold text-danger">Vencida</span> : <ActionItemStatusBadge status={r.status} />}
                  {canManage && <StatusButtons id={r.id} status={r.status} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
