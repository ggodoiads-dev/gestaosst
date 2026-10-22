"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCTION_GROUPS, fieldsOfGroup, sanitizeProductionValues, type ProductionValues } from "@/domain/production/fields";
import { parseProductionMessage } from "@/domain/production/parse";
import { loadShiftProductionAction, saveShiftProductionAction } from "@/server/actions/production.actions";

type Turno = { id: string; name: string };
type Props = { turnos: Turno[]; today: string; initialDay: string; initialTurnoId: string };

const toText = (values: ProductionValues) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]));

export function LaunchForm({ turnos, today, initialDay, initialTurnoId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [day, setDay] = useState(initialDay);
  const [turnoId, setTurnoId] = useState(initialTurnoId);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [paste, setPaste] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [existing, setExisting] = useState(false);
  const skipLoad = useRef(false);

  // Abre preenchido quando já existe relatório para o dia + turno escolhidos (para corrigir).
  useEffect(() => {
    if (skipLoad.current) {
      skipLoad.current = false;
      return;
    }
    if (!day || !turnoId) return;
    let cancelled = false;
    void loadShiftProductionAction(day, turnoId).then((found) => {
      if (cancelled) return;
      setExisting(!!found);
      setFields(found ? toText(found.values) : {});
      setNotes(found?.notes ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [day, turnoId]);

  function applyPaste() {
    const parsed = parseProductionMessage(paste);
    if (Object.keys(parsed.values).length === 0) {
      toast.error("Não encontrei os campos do relatório nessa mensagem.");
      return;
    }
    // Se a mensagem traz a data e o turno, escolhe eles; o relatório existente desse dia não é carregado por cima do que veio colado.
    let nextDay = day;
    if (parsed.date) {
      const year = parsed.date.year ?? Number(today.slice(0, 4));
      const candidate = `${year}-${String(parsed.date.month).padStart(2, "0")}-${String(parsed.date.day).padStart(2, "0")}`;
      if (candidate <= today) nextDay = candidate;
    }
    const nextTurno = parsed.turno ? turnos.find((t) => t.name.toUpperCase() === parsed.turno)?.id : undefined;
    if (nextDay !== day || (nextTurno && nextTurno !== turnoId)) skipLoad.current = true;
    setDay(nextDay);
    if (nextTurno) setTurnoId(nextTurno);
    setFields(toText(parsed.values));
    setNotes(parsed.notes);
    setWarnings(parsed.unmatched);
    setPaste("");
    toast.success(`${Object.keys(parsed.values).length} campos preenchidos. Confira e salve.`);
  }

  function save() {
    const values: ProductionValues = {};
    for (const [key, text] of Object.entries(fields)) {
      if (text.trim() === "") continue;
      const n = Number(text.replace(",", "."));
      if (Number.isFinite(n)) values[key] = n;
    }
    const clean = sanitizeProductionValues(values);
    start(async () => {
      const res = await saveShiftProductionAction({ day, turnoId, values: clean, notes });
      if (res.ok) {
        toast.success("Relatório do turno salvo.");
        router.push(`/producao?periodo=${day.slice(0, 7)}`);
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-md border border-border bg-surface p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardPaste className="size-4 text-foreground-subtle" /> Colar o relatório do WhatsApp
        </div>
        <p className="mb-2 text-xs text-foreground-subtle">Cole a mensagem de fim de turno aqui e os campos abaixo são preenchidos sozinhos. Confira antes de salvar.</p>
        <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder="*GERAL*&#10;Carros Carregados: 21&#10;…" />
        <Button variant="secondary" className="mt-2" onClick={applyPaste} disabled={paste.trim() === ""}>
          Preencher os campos
        </Button>
        {warnings.length > 0 && (
          <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">Não reconheci: {warnings.join(" · ")}</p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Dia do turno
          <input type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Turno
          <select value={turnoId} onChange={(e) => setTurnoId(e.target.value)} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground">
            {turnos.map((t) => (
              <option key={t.id} value={t.id}>Turno {t.name}</option>
            ))}
          </select>
        </label>
        {existing && <p className="text-xs text-warning sm:col-span-2">Já existe um relatório para este dia e turno. Salvar substitui os números dele.</p>}
      </section>

      {PRODUCTION_GROUPS.map((g) => (
        <section key={g.key} className="rounded-md border border-border bg-surface">
          <div className="border-b border-border bg-surface-muted px-3 py-2">
            <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
            <p className="text-[11px] text-foreground-subtle">{g.hint}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 md:grid-cols-3 lg:grid-cols-4">
            {fieldsOfGroup(g.key).map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-subtle">
                {f.label}
                <input
                  type="text"
                  inputMode={f.signed ? "text" : "numeric"}
                  value={fields[f.key] ?? ""}
                  onChange={(e) => setFields((cur) => ({ ...cur, [f.key]: e.target.value.replace(f.signed ? /[^\d-]/g : /\D/g, "") }))}
                  className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm tabular-nums text-foreground"
                  placeholder="0"
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-md border border-border bg-surface p-3">
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Observações
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Ocorrências do turno, o que ficou pendente…" />
        </label>
      </section>

      <div className="flex gap-2">
        <Button onClick={save} loading={pending} disabled={!day || !turnoId}>
          Salvar relatório do turno
        </Button>
        <Button variant="ghost" onClick={() => router.push("/producao")}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
