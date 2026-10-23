"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCTION_GROUPS, fieldsOfGroup, sanitizeProductionValues, type ProductionValues } from "@/domain/production/fields";
import { looksLikeHelpersClosing, parseAnyProductionMessage } from "@/domain/production/parse";
import { SECTION_LABELS, detailsNote, parseHelpersPeople, shareQuantity, suggestActivityId, type PeopleSection } from "@/domain/production/people";
import { loadShiftProductionAction, savePeopleEntriesAction, saveShiftProductionAction } from "@/server/actions/production.actions";

type Turno = { id: string; name: string };
type Named = { id: string; name: string };
type Props = { turnos: Turno[]; today: string; initialDay: string; initialTurnoId: string; helpers: Named[]; activities: Named[] };

/** Uma linha da prévia "lançar também por pessoa": quem, em qual atividade e quanto. */
type PersonRow = { key: string; section: PeopleSection; nameInMessage: string; collaboratorId: string; activityId: string; quantity: string; notes: string; include: boolean };

const toText = (values: ProductionValues) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]));

/** A mesma pessoa na mesma atividade em dois blocos da mensagem (ex.: duas ordens do DPVIM) vira um lançamento só, com as quantidades somadas. */
function mergeRows(chosen: PersonRow[]) {
  const merged = new Map<string, { collaboratorId: string; activityId: string; quantity: number | null; notes: string[] }>();
  for (const r of chosen) {
    const key = `${r.collaboratorId}|${r.activityId}`;
    const q = r.quantity.trim() === "" ? null : Number(r.quantity);
    const cur = merged.get(key) ?? { collaboratorId: r.collaboratorId, activityId: r.activityId, quantity: null, notes: [] };
    if (q !== null) cur.quantity = (cur.quantity ?? 0) + q;
    if (r.notes && !cur.notes.includes(r.notes)) cur.notes.push(r.notes);
    merged.set(key, cur);
  }
  return [...merged.values()].map((m) => ({ collaboratorId: m.collaboratorId, activityId: m.activityId, quantity: m.quantity, notes: m.notes.join(" | ") }));
}

export function LaunchForm({ turnos, today, initialDay, initialTurnoId, helpers, activities }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [day, setDay] = useState(initialDay);
  const [turnoId, setTurnoId] = useState(initialTurnoId);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [paste, setPaste] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [existing, setExisting] = useState(false);
  const [rows, setRows] = useState<PersonRow[]>([]);
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

  async function applyPaste() {
    const parsed = parseAnyProductionMessage(paste);
    // O fechamento dos ajudantes também vira lançamento por pessoa (prévia abaixo, para conferir).
    let personRows: PersonRow[] = [];
    let personWarnings: string[] = [];
    if (looksLikeHelpersClosing(paste)) {
      const people = parseHelpersPeople(paste, helpers);
      personWarnings = people.unrecognized;
      personRows = people.entries.flatMap((entry, ei) => {
        const shares = shareQuantity(entry.quantity, entry.people.length);
        return entry.people.map((p, pi) => ({
          key: `${ei}-${pi}-${entry.section}`,
          section: entry.section,
          nameInMessage: p.text,
          collaboratorId: p.candidateIds.length === 1 ? p.candidateIds[0] : "",
          activityId: suggestActivityId(entry.section, activities),
          quantity: shares[pi] === null || shares[pi] === undefined ? "" : String(shares[pi]),
          notes: detailsNote(entry, entry.people.length),
          include: true,
        }));
      });
    }
    if (Object.keys(parsed.values).length === 0 && personRows.length === 0) {
      toast.error("Não encontrei os campos do relatório nessa mensagem.");
      return;
    }
    // Se a mensagem traz a data e o turno, escolhe eles e abre o relatório que já existe nesse dia e turno, para o colado somar a ele (nunca substituir).
    let nextDay = day;
    if (parsed.date) {
      const year = parsed.date.year ?? Number(today.slice(0, 4));
      const candidate = `${year}-${String(parsed.date.month).padStart(2, "0")}-${String(parsed.date.day).padStart(2, "0")}`;
      if (candidate <= today) nextDay = candidate;
    }
    const nextTurno = parsed.turno ? turnos.find((t) => t.name.toUpperCase() === parsed.turno)?.id : undefined;
    const changedReport = nextDay !== day || (!!nextTurno && nextTurno !== turnoId);
    if (changedReport) skipLoad.current = true;
    setDay(nextDay);
    if (nextTurno) setTurnoId(nextTurno);
    // Soma ao que já está na tela: o relatório do líder e o fechamento dos ajudantes do mesmo turno entram no mesmo relatório.
    if (changedReport) {
      const found = await loadShiftProductionAction(nextDay, nextTurno ?? turnoId);
      setExisting(!!found);
      setFields({ ...(found ? toText(found.values) : {}), ...toText(parsed.values) });
      setNotes(parsed.notes || found?.notes || "");
    } else {
      setFields((cur) => ({ ...cur, ...toText(parsed.values) }));
      if (parsed.notes) setNotes(parsed.notes);
    }
    setWarnings([...parsed.unmatched, ...personWarnings.map((w) => `${w} (nome não reconhecido)`)]);
    if (personRows.length > 0) setRows(personRows);
    setPaste("");
    toast.success(`${Object.keys(parsed.values).length} campos preenchidos${personRows.length > 0 ? ` e ${personRows.length} lançamentos por pessoa na prévia` : ""}. Confira e salve.`);
  }

  function save() {
    const values: ProductionValues = {};
    for (const [key, text] of Object.entries(fields)) {
      if (text.trim() === "") continue;
      const n = Number(text.replace(",", "."));
      if (Number.isFinite(n)) values[key] = n;
    }
    const clean = sanitizeProductionValues(values);
    const chosen = rows.filter((r) => r.include);
    if (chosen.some((r) => !r.collaboratorId || !r.activityId)) {
      toast.error("Escolha o ajudante e a atividade das linhas marcadas (ou desmarque as que não quer lançar).");
      return;
    }
    start(async () => {
      if (Object.keys(clean).length > 0) {
        const res = await saveShiftProductionAction({ day, turnoId, values: clean, notes });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
      }
      let peopleMessage = "";
      if (chosen.length > 0) {
        const res = await savePeopleEntriesAction({
          day,
          entries: mergeRows(chosen),
        });
        if (!res.ok) {
          toast.error(`O total do turno foi salvo, mas o lançamento por pessoa falhou: ${res.error}`);
          return;
        }
        peopleMessage = ` ${res.created + res.updated} lançamento(s) por pessoa gravados${res.skipped > 0 ? `, ${res.skipped} não puderam ser lançados` : ""}.`;
      }
      toast.success(`Relatório do turno salvo.${peopleMessage}`);
      router.push(`/producao?periodo=${day.slice(0, 7)}`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-md border border-border bg-surface p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ClipboardPaste className="size-4 text-foreground-subtle" /> Colar o relatório do WhatsApp
        </div>
        <p className="mb-2 text-xs text-foreground-subtle">Cole aqui a mensagem de fim de turno do líder ou o fechamento dos ajudantes (seleção): os campos abaixo são preenchidos sozinhos. No fechamento dos ajudantes, o que cada pessoa fez também aparece para lançar por pessoa. Pode colar as duas mensagens, uma de cada vez. Confira antes de salvar.</p>
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

      {rows.length > 0 && (
        <section className="rounded-md border border-border bg-surface">
          <div className="border-b border-border bg-surface-muted px-3 py-2">
            <h3 className="text-sm font-semibold text-foreground">Lançar também por pessoa</h3>
            <p className="text-[11px] text-foreground-subtle">
              Cada linha marcada vira um lançamento na página do ajudante, no dia escolhido acima. Se a pessoa já tem essa atividade nesse dia, o lançamento é atualizado, não duplicado. Nas equipes (ex.: Jean/Bernardo) a quantidade foi dividida igualmente: ajuste se precisar.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-foreground-subtle">
                  <th className="w-8 px-2 py-1.5" />
                  <th className="px-2 py-1.5 text-left font-semibold">Na mensagem</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Ajudante</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Atividade</th>
                  <th className="w-28 px-2 py-1.5 text-right font-semibold">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const incomplete = r.include && (!r.collaboratorId || !r.activityId);
                  const update = (patch: Partial<PersonRow>) => setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, ...patch } : x)));
                  return (
                    <tr key={r.key} className={`border-b border-border last:border-b-0 ${incomplete ? "bg-warning-soft" : ""}`}>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" checked={r.include} onChange={(e) => update({ include: e.target.checked })} className="size-4 accent-[var(--accent)]" aria-label="Lançar esta linha" />
                      </td>
                      <td className="px-2 py-1.5 text-foreground">
                        {r.nameInMessage || "—"}
                        <span className="block text-[11px] text-foreground-subtle">{SECTION_LABELS[r.section]}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={r.collaboratorId} onChange={(e) => update({ collaboratorId: e.target.value })} className="h-8 w-full rounded-md border border-border-strong bg-surface px-1.5 text-sm text-foreground">
                          <option value="">Escolher…</option>
                          {helpers.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={r.activityId} onChange={(e) => update({ activityId: e.target.value })} className="h-8 w-full rounded-md border border-border-strong bg-surface px-1.5 text-sm text-foreground">
                          <option value="">Escolher…</option>
                          {activities.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" inputMode="numeric" value={r.quantity} onChange={(e) => update({ quantity: e.target.value.replace(/\D/g, "") })} className="h-8 w-full rounded-md border border-border-strong bg-surface px-2 text-right text-sm tabular-nums text-foreground" placeholder="—" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-md border border-border bg-surface p-3">
        <label className="flex flex-col gap-1 text-xs text-foreground-subtle">
          Observações
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Ocorrências do turno, o que ficou pendente…" />
        </label>
      </section>

      <div className="flex gap-2">
        <Button onClick={save} loading={pending} disabled={!day || !turnoId}>
          Salvar
        </Button>
        <Button variant="ghost" onClick={() => router.push("/producao")}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
