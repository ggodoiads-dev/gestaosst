"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ActionItemStatusBadge } from "@/components/domain/status-badges";
import { formatDate } from "@/lib/dates";
import { formatPersonName } from "@/lib/format-name";
import { groupByAction } from "@/domain/dto/action-group";
import { setDtoActionsStatusAction, rescheduleDtoActionsAction } from "@/server/actions/dto-action.actions";
import type { DtoActionRow } from "@/server/services/dto-action.service";

type Filter = "abertas" | "concluidas" | "todas";

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const isOpen = (r: DtoActionRow) => r.status !== "CONCLUIDA" && r.status !== "CANCELADA";
const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function CancelDialog({ ids, title, label = "Cancelar" }: { ids: string[]; title: string; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await setDtoActionsStatusAction(ids, "CANCELADA", reason);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.count > 1 ? `${res.count} ações canceladas.` : "Ação cancelada.");
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} disabled={ids.length === 0}>
        {label}
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{ids.length > 1 ? `Cancelar ${ids.length} ações?` : "Cancelar esta ação?"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{title}</p>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Justificativa (obrigatória)
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Por que esta ação não vai ser feita?" className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal" />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Voltar
            </Button>
          </DialogClose>
          <Button onClick={confirm} loading={pending} variant="danger">
            {ids.length > 1 ? "Cancelar ações" : "Cancelar ação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RescheduleDialog({ ids, title, currentDue }: { ids: string[]; title: string; currentDue?: Date }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await rescheduleDtoActionsAction(ids, day, reason);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.count > 1 ? `${res.count} ações reprogramadas.` : "Ação reprogramada.");
      setOpen(false);
      setDay("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} disabled={ids.length === 0}>
        <CalendarClock className="size-3.5" /> Reprogramar
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{ids.length > 1 ? `Reprogramar ${ids.length} ações` : "Reprogramar ação"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{title}</p>
          {currentDue && <p className="text-xs text-foreground-subtle">Prazo atual: {formatDate(currentDue)}</p>}
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Novo prazo
            <input type="date" value={day} min={todayKey()} onChange={(e) => setDay(e.target.value)} className="h-9 rounded-md border border-border-strong bg-surface px-3 text-sm font-normal" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[3, 7, 15, 30].map((n) => (
              <Button key={n} type="button" size="sm" variant="secondary" onClick={() => setDay(plusDays(n))}>
                +{n} dias
              </Button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Motivo (opcional)
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: colaborador de férias, curso sem turma até lá" className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-normal" />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Voltar
            </Button>
          </DialogClose>
          <Button onClick={confirm} loading={pending} disabled={!day}>
            Reprogramar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Iniciar / Concluir / Reprogramar / Cancelar para uma ou várias ações (as selecionadas de um grupo). */
function ActionButtons({ rows, title, bulk = false }: { rows: DtoActionRow[]; title: string; bulk?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const open = rows.filter(isOpen);
  const pendentes = open.filter((r) => r.status === "PENDENTE");

  function set(ids: string[], status: DtoActionRow["status"], okMessage: string) {
    startTransition(async () => {
      const res = await setDtoActionsStatusAction(ids, status);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(okMessage);
      router.refresh();
    });
  }

  if (open.length === 0) {
    return (
      <Button size="sm" variant="ghost" loading={pending} disabled={rows.length === 0} onClick={() => set(rows.map((r) => r.id), "PENDENTE", rows.length > 1 ? "Ações reabertas." : "Ação reaberta.")}>
        Reabrir
      </Button>
    );
  }
  const n = (k: number) => (bulk ? ` (${k})` : "");
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {pendentes.length > 0 && (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => set(pendentes.map((r) => r.id), "EM_ANDAMENTO", pendentes.length > 1 ? `${pendentes.length} ações em andamento.` : "Ação em andamento.")}>
          Iniciar{n(pendentes.length)}
        </Button>
      )}
      <Button size="sm" loading={pending} onClick={() => set(open.map((r) => r.id), "CONCLUIDA", open.length > 1 ? `${open.length} ações concluídas.` : "Ação concluída.")}>
        Concluir{n(open.length)}
      </Button>
      <RescheduleDialog ids={open.map((r) => r.id)} title={title} currentDue={open.length === 1 ? open[0].dueDate : undefined} />
      <CancelDialog ids={open.map((r) => r.id)} title={title} />
    </div>
  );
}

function Owner({ r }: { r: DtoActionRow }) {
  return (
    <span>
      Responsável:{" "}
      {r.ownerNames.length > 0 ? (
        <>
          <strong className="font-medium text-foreground">{r.ownerNames.slice(0, 3).map(formatPersonName).join(" / ")}</strong> <span className="text-foreground-subtle">({r.ownerRole})</span>
        </>
      ) : (
        r.ownerRole
      )}
    </span>
  );
}

function StatusTags({ r, now }: { r: DtoActionRow; now: Date }) {
  const overdue = isOpen(r) && new Date(r.dueDate) < now;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {overdue && <Badge tone="danger">Vencida</Badge>}
      <ActionItemStatusBadge status={r.status} />
    </div>
  );
}

function SingleCard({ r, canManage, now }: { r: DtoActionRow; canManage: boolean; now: Date }) {
  const overdue = isOpen(r) && new Date(r.dueDate) < now;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{r.title}</p>
        <p className="mt-0.5 text-sm text-foreground-muted">{r.detail}</p>
        <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-foreground-subtle">
          <Link href="/dto" className="hover:underline">
            DTO de {formatPersonName(r.collaboratorName)} — {r.activity} ({formatDate(r.dtoDate)})
          </Link>
          <span>·</span>
          <Owner r={r} />
          <span>·</span>
          <span className={cn(overdue && "font-medium text-danger")}>Prazo: {formatDate(r.dueDate)}</span>
        </p>
        {r.status === "CANCELADA" && r.cancelReason && <p className="mt-1 text-xs text-foreground-subtle">Justificativa do cancelamento: {r.cancelReason}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
        <StatusTags r={r} now={now} />
        {canManage && <ActionButtons rows={[r]} title={r.title} />}
      </div>
    </div>
  );
}

/** Mesma ação para vários colaboradores: um cartão só, com seleção de quem entra e os botões valendo para os selecionados. */
function GroupCard({ title, rows, canManage, now }: { title: string; rows: DtoActionRow[]; canManage: boolean; now: Date }) {
  const [off, setOff] = useState<Set<string>>(new Set());
  const openRows = rows.filter(isOpen);
  const selected = openRows.filter((r) => !off.has(r.id));
  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = openRows.length > 0 && selected.length === openRows.length;
  const earliest = openRows.length > 0 ? openRows.reduce((m, r) => (new Date(r.dueDate) < new Date(m.dueDate) ? r : m)).dueDate : null;
  const overdueCount = openRows.filter((r) => new Date(r.dueDate) < now).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <Badge tone="info">{rows.length} colaboradores</Badge>
            {overdueCount > 0 && <Badge tone="danger">{overdueCount} vencida(s)</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-foreground-muted">{rows[0].detail}</p>
          {earliest && <p className="mt-1 text-xs text-foreground-subtle">Primeiro prazo: {formatDate(earliest)}</p>}
        </div>
        {canManage && openRows.length > 0 && (
          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
            <ActionButtons rows={selected} title={title} bulk />
            <p className="text-[11px] text-foreground-subtle">Vale para os {selected.length} marcado(s)</p>
          </div>
        )}
        {canManage && openRows.length === 0 && <ActionButtons rows={rows} title={title} bulk />}
      </div>

      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        {canManage && openRows.length > 1 && (
          <label className="flex items-center gap-2 bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground-muted">
            <input type="checkbox" checked={allSelected} onChange={() => setOff(allSelected ? new Set(openRows.map((r) => r.id)) : new Set())} />
            Marcar todos
          </label>
        )}
        {rows.map((r) => {
          const overdue = isOpen(r) && new Date(r.dueDate) < now;
          return (
            <div key={r.id} className="flex items-start gap-2 px-3 py-2">
              {canManage && isOpen(r) ? <input type="checkbox" className="mt-1" checked={!off.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Incluir ${r.collaboratorName}`} /> : <span className="w-[13px]" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{formatPersonName(r.collaboratorName)}</p>
                <p className="flex flex-wrap gap-x-2 text-xs text-foreground-subtle">
                  <Link href="/dto" className="hover:underline">
                    {r.activity} ({formatDate(r.dtoDate)})
                  </Link>
                  <span>·</span>
                  <Owner r={r} />
                  <span>·</span>
                  <span className={cn(overdue && "font-medium text-danger")}>Prazo: {formatDate(r.dueDate)}</span>
                </p>
                {r.status === "CANCELADA" && r.cancelReason && <p className="text-xs text-foreground-subtle">Justificativa do cancelamento: {r.cancelReason}</p>}
              </div>
              <StatusTags r={r} now={now} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ações corretivas dos DTOs (sugeridas pelo Rico) com prazo e status. `canManage` = quem pode mudar o status. */
export function DtoActionsTable({ rows, canManage }: { rows: DtoActionRow[]; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("abertas");
  const now = new Date();

  const open = rows.filter(isOpen);
  const overdue = open.filter((r) => new Date(r.dueDate) < now).length;
  const groups = useMemo(() => {
    const shown = rows.filter(
      (r) => (filter === "todas" || (filter === "abertas" ? isOpen(r) : r.status === "CONCLUIDA")) && (!query || normalize(r.collaboratorName).includes(normalize(query)) || normalize(r.title).includes(normalize(query))),
    );
    return groupByAction(shown);
  }, [rows, filter, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar colaborador ou ação..." className="h-9 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm text-foreground" />
        </div>
        <div className="flex overflow-hidden rounded-md border border-border-strong">
          {(
            [
              ["abertas", `Abertas (${open.length})`],
              ["concluidas", "Concluídas"],
              ["todas", "Todas"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className={cn("px-3 py-1.5 text-xs font-medium", filter === key ? "bg-accent text-accent-foreground" : "bg-surface text-foreground-subtle hover:bg-surface-muted")}>
              {label}
            </button>
          ))}
        </div>
        {overdue > 0 && <span className="text-xs font-medium text-danger">{overdue} vencida(s)</span>}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface px-4 py-10 text-center text-sm text-foreground-subtle">
          {rows.length === 0 ? "Nenhuma ação de DTO ainda. Elas nascem das sugestões do Rico para os pontos negativos de cada DTO." : "Nenhuma ação com esse filtro."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g) => (g.rows.length === 1 ? <SingleCard key={g.rows[0].id} r={g.rows[0]} canManage={canManage} now={now} /> : <GroupCard key={g.key} title={g.title} rows={g.rows} canManage={canManage} now={now} />))}
        </div>
      )}
    </div>
  );
}
