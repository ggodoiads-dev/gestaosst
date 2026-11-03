"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { savePdcaAction } from "@/server/actions/pdca.actions";
import type { PdcaData } from "@/server/services/pdca.service";
import { PDCA_ACTION_STATUS_LABEL, type PdcaAction, type PdcaActionStatus } from "@/domain/termination/pdca";

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const field = "flex flex-col gap-1.5";
const label = "text-[13px] font-medium text-foreground-muted";

/** Metas, causas (Plan), ações (Do) e padronização (Act) do ano, salvos juntos. O Check (acompanhamento) vem pronto do servidor. */
export function PdcaEditor({ year, initial, diagnosis, kinds, ivOptions, planExtra, cascadeSlot, checkSlot }: { year: number; initial: PdcaData; diagnosis: string[]; kinds: { label: string; count: number }[]; ivOptions: { id: string; label: string }[]; planExtra?: React.ReactNode; cascadeSlot?: React.ReactNode; checkSlot?: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [data, setData] = useState<PdcaData>(initial);
  const [dirty, setDirty] = useState(false);
  const set = (patch: Partial<PdcaData>) => {
    setData((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  // As metas ficam como texto enquanto se digita ("13," não pode virar "13"); viram número só ao salvar.
  const goalText = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
  const [goals, setGoals] = useState({ monthly: goalText(initial.monthlyGoal), ytd: goalText(initial.ytdGoal), annual: goalText(initial.annualGoal) });
  const toGoal = (s: string) => {
    const n = Number(s.replace(",", "."));
    return s.trim() === "" || !Number.isFinite(n) ? null : n;
  };
  const setGoal = (patch: Partial<typeof goals>) => {
    setGoals((g) => ({ ...g, ...patch }));
    setDirty(true);
  };
  const setAction = (id: string, patch: Partial<PdcaAction>) => set({ actions: data.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) });

  function save() {
    start(async () => {
      const res = await savePdcaAction(year, { ...data, monthlyGoal: toGoal(goals.monthly), ytdGoal: toGoal(goals.ytd), annualGoal: toGoal(goals.annual) });
      if (res.ok) {
        toast.success("PDCA salvo.");
        setDirty(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Metas e responsável</CardTitle>
          <CardDescription>Em percentual do turnover dos últimos 12 meses. As metas alimentam o Check acima depois de salvar.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className={field}>
            <label className={label}>Meta do mês (%)</label>
            <Input inputMode="decimal" value={goals.monthly} onChange={(e) => setGoal({ monthly: e.target.value })} placeholder="13,92" />
          </div>
          <div className={field}>
            <label className={label}>Meta acumulada YTD (%)</label>
            <Input inputMode="decimal" value={goals.ytd} onChange={(e) => setGoal({ ytd: e.target.value })} placeholder="13,92" />
          </div>
          <div className={field}>
            <label className={label}>Meta do ano (%)</label>
            <Input inputMode="decimal" value={goals.annual} onChange={(e) => setGoal({ annual: e.target.value })} placeholder="14,07" />
          </div>
          <div className={field}>
            <label className={label}>Dono do PDCA</label>
            <Input value={data.owner} onChange={(e) => set({ owner: e.target.value })} placeholder="Nome do responsável" maxLength={120} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan — diagnóstico e cascata (IC → IV)</CardTitle>
          <CardDescription>O diagnóstico vem dos números das saídas dos últimos 12 meses. A cascata abre o turnover (IC) nos itens de verificação (IVs) que o explicam, e cada IV pode abrir de novo com o “por quê?”, até a causa raiz.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">O que os números mostram</p>
            {diagnosis.length === 0 ? <p className="text-sm text-foreground-subtle">Sem desligamentos importados na janela.</p> : diagnosis.map((d) => (
              <p key={d} className="text-sm text-foreground-muted">• {d}</p>
            ))}
            {kinds.length > 0 && <p className="text-xs text-foreground-subtle">Tipos na janela: {kinds.map((k) => `${k.label} ${k.count}`).join(" · ")}.</p>}
          </div>
          {planExtra}
          {cascadeSlot}
          {data.causes.length > 0 && (
            <details className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer select-none font-medium text-foreground-muted">Causas anotadas antes da cascata ({data.causes.length})</summary>
              <div className="mt-2 flex flex-col gap-2">
                {data.causes.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-2">
                    <p className="text-foreground-muted">
                      • {c.text}
                      {c.evidence ? <span className="text-foreground-subtle"> — {c.evidence}</span> : null}
                    </p>
                    <Button size="icon" variant="ghost" onClick={() => set({ causes: data.causes.filter((x) => x.id !== c.id) })} aria-label="Remover causa">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-foreground-subtle">Se ainda valem, abra um IV na cascata acima com o mesmo texto. Depois remova daqui.</p>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Do — plano de ação</CardTitle>
          <CardDescription>O que será feito, por quê, quem faz e até quando. Atualize o status e o resultado conforme avança.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.actions.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Textarea rows={2} value={a.what} onChange={(e) => setAction(a.id, { what: e.target.value })} placeholder="O que será feito" maxLength={600} />
                <Textarea rows={2} value={a.why} onChange={(e) => setAction(a.id, { why: e.target.value })} placeholder="Por quê (qual causa ataca)" maxLength={600} />
              </div>
              <Select value={a.causeId ?? "none"} onValueChange={(v) => setAction(a.id, { causeId: v === "none" ? null : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem item da cascata ligado</SelectItem>
                  {ivOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label.length > 90 ? o.label.slice(0, 90) + "…" : o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem_10rem_auto]">
                <Input value={a.who} onChange={(e) => setAction(a.id, { who: e.target.value })} placeholder="Quem" maxLength={120} />
                <Input type="date" value={a.due} onChange={(e) => setAction(a.id, { due: e.target.value })} aria-label="Prazo" />
                <Select value={a.status} onValueChange={(v) => setAction(a.id, { status: v as PdcaActionStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PDCA_ACTION_STATUS_LABEL) as PdcaActionStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {PDCA_ACTION_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => set({ actions: data.actions.filter((x) => x.id !== a.id) })} aria-label="Remover ação">
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Input value={a.note} onChange={(e) => setAction(a.id, { note: e.target.value })} placeholder="Resultado / andamento" maxLength={600} />
            </div>
          ))}
          <div>
            <Button variant="secondary" onClick={() => set({ actions: [...data.actions, { id: newId(), what: "", why: "", who: "", due: "", status: "PENDENTE", note: "", causeId: null }] })}>
              <Plus className="size-4" /> Adicionar ação
            </Button>
          </div>
        </CardContent>
      </Card>

      {checkSlot}

      <Card>
        <CardHeader>
          <CardTitle>Act — padronização e aprendizado</CardTitle>
          <CardDescription>O que deu certo e vira regra da operação, e o que muda no próximo ciclo se a meta não foi atingida.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea rows={5} value={data.standardization} onChange={(e) => set({ standardization: e.target.value })} maxLength={4000} placeholder="Ex.: a integração de 5 dias com o líder passou a ser obrigatória para todo admitido; revisar a faixa de salário do cargo X no próximo ciclo." />
        </CardContent>
      </Card>

      <div className="sticky bottom-3 flex justify-end">
        <Button onClick={save} loading={pending} disabled={!dirty}>
          {dirty ? "Salvar PDCA" : "Sem alterações"}
        </Button>
      </div>
    </>
  );
}
