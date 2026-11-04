"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ADHERENCE_LABEL, SKILL_LEVELS, levelEmoji, levelLabel, matrixStats } from "@/domain/pipeline/matrix";
import { addMemberAction, addSkillAction, createMatrixAction, deleteMatrixAction, deleteMemberAction, deleteSkillAction, renameMatrixAction, setLevelAction } from "@/server/actions/pipeline-matrix.actions";
import type { MatrixView } from "@/server/services/pipeline-matrix.service";
import { cn } from "@/lib/utils";

type Current = NonNullable<MatrixView["current"]>;

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const LEVEL_TONE: Record<number, string> = {
  0: "bg-danger-soft text-danger",
  1: "bg-warning-soft text-warning",
  2: "bg-success-soft text-success",
  3: "bg-info-soft text-info",
  4: "bg-accent-soft text-accent",
};
const ADH_TONE = { BASICO: "danger", INTERMEDIARIO: "warning", AVANCADO: "success" } as const;

function NewMatrixDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [skills, setSkills] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await createMatrixAction(name, skills.split("\n"));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Matriz criada.");
      setOpen(false);
      setName("");
      setSkills("");
      router.push(`/pipeline?aba=matriz&m=${res.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nova matriz
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova matriz de função</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <FormField label="Nome da matriz" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex.: Amarrador" />
          </FormField>
          <FormField label="Atividades (uma por linha)">
            <textarea rows={6} value={skills} onChange={(e) => setSkills(e.target.value)} className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm" placeholder={"5S\nCarregamento\nAmarração"} />
          </FormField>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={save} loading={pending}>
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({ matrixId, collaborators, existing }: { matrixId: string; collaborators: MatrixView["collaborators"]; existing: Set<string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("none");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [grp, setGrp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chosen = collaborators.find((c) => c.id === pick);

  function save() {
    setError(null);
    start(async () => {
      const res = await addMemberAction(matrixId, { collaboratorId: chosen?.id ?? null, name: chosen?.name ?? name, role: role || chosen?.functionName || null, grp: grp || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Pessoa adicionada.");
      setOpen(false);
      setPick("none");
      setName("");
      setRole("");
      setGrp("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Adicionar pessoa
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar pessoa à matriz</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <FormField label="Colaborador do cadastro">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Outra pessoa (digitar o nome)</SelectItem>
                {collaborators
                  .filter((c) => !existing.has(c.id))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.functionName ? ` — ${c.functionName}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
          {pick === "none" && (
            <FormField label="Nome" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Função">
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={chosen?.functionName ?? ""} maxLength={120} />
            </FormField>
            <FormField label="Grupo">
              <Input value={grp} onChange={(e) => setGrp(e.target.value)} placeholder="Padrinho, Operacional..." maxLength={80} />
            </FormField>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={save} loading={pending}>
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDeleteMatrix({ matrix }: { matrix: Current }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(matrix.name);
  const [pending, start] = useTransition();

  function rename() {
    start(async () => {
      const res = await renameMatrixAction(matrix.id, name);
      if (!res.ok) return void toast.error(res.error);
      setOpen(false);
      router.refresh();
    });
  }
  function remove() {
    if (!window.confirm(`Apagar a matriz "${matrix.name}" com as pessoas e os níveis?`)) return;
    start(async () => {
      const res = await deleteMatrixAction(matrix.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Matriz apagada.");
      router.push("/pipeline?aba=matriz");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Renomear a matriz">
        <Pencil className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={remove} loading={pending} aria-label="Apagar a matriz">
        <Trash2 className="size-4" />
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Renomear a matriz</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button onClick={rename} loading={pending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Grade da matriz: pessoas nas linhas, atividades nas colunas. Clique numa célula para escolher o nível; a aderência e o nível da pessoa se recalculam na hora. */
export function MatrixGrid({ matrix, matrices, collaborators }: { matrix: Current | null; matrices: MatrixView["matrices"]; collaborators: MatrixView["collaborators"] }) {
  const router = useRouter();
  const [levels, setLevels] = useState<Record<string, Record<string, number>>>(() => Object.fromEntries((matrix?.members ?? []).map((m) => [m.id, m.levels])));
  const [newSkill, setNewSkill] = useState("");
  const [, start] = useTransition();

  const stats = useMemo(() => (matrix ? matrixStats(matrix.skills.map((s) => s.id), matrix.members.map((m) => ({ id: m.id, levels: levels[m.id] ?? {} }))) : null), [matrix, levels]);

  function pick(memberId: string, skillId: string, level: number | null) {
    const previous = levels[memberId]?.[skillId] ?? null;
    setLevels((cur) => {
      const mine = { ...(cur[memberId] ?? {}) };
      if (level === null) delete mine[skillId];
      else mine[skillId] = level;
      return { ...cur, [memberId]: mine };
    });
    start(async () => {
      const res = await setLevelAction(memberId, skillId, level);
      if (!res.ok) {
        toast.error(res.error);
        setLevels((cur) => {
          const mine = { ...(cur[memberId] ?? {}) };
          if (previous === null) delete mine[skillId];
          else mine[skillId] = previous;
          return { ...cur, [memberId]: mine };
        });
      }
    });
  }

  function addSkill() {
    if (!matrix) return;
    start(async () => {
      const res = await addSkillAction(matrix.id, newSkill);
      if (!res.ok) return void toast.error(res.error);
      setNewSkill("");
      router.refresh();
    });
  }

  function removeSkill(skillId: string, name: string) {
    if (!window.confirm(`Remover a atividade "${name}" e os níveis dela?`)) return;
    start(async () => {
      const res = await deleteSkillAction(skillId);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  function removeMember(memberId: string, name: string) {
    if (!window.confirm(`Tirar ${name} da matriz?`)) return;
    start(async () => {
      const res = await deleteMemberAction(memberId);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {matrices.map((m) => (
          <a key={m.id} href={`/pipeline?aba=matriz&m=${m.id}`} className={cn("rounded-md border px-3 py-1.5 text-sm font-medium", m.id === matrix?.id ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface text-foreground-subtle hover:bg-surface-muted")}>
            {m.name}
          </a>
        ))}
        <NewMatrixDialog />
      </div>

      {!matrix ? (
        <p className="rounded-md bg-surface-muted px-3 py-3 text-sm text-foreground-subtle">Nenhuma matriz ainda. Crie uma ou importe a planilha de gestão do pipeline.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-semibold text-foreground">{matrix.name}</h3>
              <RenameDeleteMatrix matrix={matrix} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Nova atividade" maxLength={120} className="h-9 w-48" onKeyDown={(e) => e.key === "Enter" && newSkill.trim() && addSkill()} />
              <Button variant="secondary" onClick={addSkill} disabled={!newSkill.trim()}>
                <Plus className="size-4" /> Atividade
              </Button>
              <AddMemberDialog matrixId={matrix.id} collaborators={collaborators} existing={new Set(matrix.members.map((m) => m.collaboratorId).filter((x): x is string => !!x))} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {SKILL_LEVELS.map((l) => (
              <span key={l.level} className={cn("rounded-full px-2.5 py-1 font-medium", LEVEL_TONE[l.level])}>
                {l.emoji} {l.label}
              </span>
            ))}
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-foreground-subtle">Aderência = atividades que executa sozinho ou ensina ÷ avaliadas · Básico &lt; 40% · Intermediário &lt; 70% · Avançado a partir de 70%</span>
          </div>

          {matrix.skills.length === 0 || matrix.members.length === 0 ? (
            <p className="rounded-md bg-surface-muted px-3 py-3 text-sm text-foreground-subtle">
              {matrix.skills.length === 0 ? "Adicione as atividades (colunas) desta matriz." : "Adicione as pessoas (linhas) desta matriz."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted">
                    <th className="sticky left-0 z-10 min-w-48 bg-surface-muted px-3 py-2 text-left text-xs font-semibold text-foreground-subtle">Pessoa</th>
                    {matrix.skills.map((s) => (
                      <th key={s.id} className="group min-w-24 px-1.5 py-2 text-center align-bottom text-[11px] font-medium leading-tight text-foreground-muted">
                        <div className="flex items-start justify-center gap-0.5">
                          <span>{s.name}</span>
                          <button type="button" onClick={() => removeSkill(s.id, s.name)} className="invisible text-foreground-subtle hover:text-danger group-hover:visible" aria-label={`Remover ${s.name}`}>
                            ×
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="min-w-24 px-2 py-2 text-center text-xs font-semibold text-foreground-subtle">Aderência</th>
                    <th className="min-w-28 px-2 py-2 text-center text-xs font-semibold text-foreground-subtle">Nível</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.members.map((m, i) => {
                    const row = stats?.byMember[i];
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{m.name}</p>
                              <p className="truncate text-[11px] text-foreground-subtle">{[m.role, m.grp].filter(Boolean).join(" · ") || "—"}</p>
                            </div>
                            <button type="button" onClick={() => removeMember(m.id, m.name)} className="text-foreground-subtle hover:text-danger" aria-label={`Tirar ${m.name}`}>
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        {matrix.skills.map((s) => {
                          const level = levels[m.id]?.[s.id] ?? null;
                          return (
                            <td key={s.id} className="px-1 py-1 text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" title={levelLabel(level)} className={cn("mx-auto flex h-8 w-11 items-center justify-center rounded text-base transition-opacity hover:opacity-75", level === null ? "bg-surface-muted text-foreground-subtle" : LEVEL_TONE[level])}>
                                    {level === null ? "·" : levelEmoji(level)}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center">
                                  {SKILL_LEVELS.map((l) => (
                                    <DropdownMenuItem key={l.level} onSelect={() => pick(m.id, s.id, l.level)}>
                                      {l.emoji} {l.label}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => pick(m.id, s.id, null)}>Limpar (não avaliado)</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1 text-center font-semibold tabular-nums">{pct(row?.value ?? null)}</td>
                        <td className="px-2 py-1 text-center">{row?.level ? <Badge tone={ADH_TONE[row.level]}>{ADHERENCE_LABEL[row.level]}</Badge> : <span className="text-foreground-subtle">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border-strong bg-surface-muted">
                    <td className="sticky left-0 bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground-subtle">Dominam a atividade</td>
                    {stats?.bySkill.map((s) => (
                      <td key={s.skillId} className="px-1 py-2 text-center text-xs font-semibold tabular-nums">
                        {pct(s.value)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center text-xs font-semibold tabular-nums" title="Média da aderência de quem foi avaliado">
                      {pct(stats?.average ?? null)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
