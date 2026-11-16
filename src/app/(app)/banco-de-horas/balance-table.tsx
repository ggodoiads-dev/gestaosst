"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteBankEntryAction } from "@/server/actions/bank-hours.actions";
import { ManualEntryDialog } from "./manual-entry-dialog";

type Line = { id: string | null; date: string; days: number; label: string; note: string | null; by: string | null; removable: boolean };
type Person = { collaboratorId: string; name: string; turnoName: string | null; functionName: string | null; credits: number; debits: number; balance: number; ledger: Line[] };

const br = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
const fmt = (n: number) => String(n).replace(".", ",");

/** Saldo de cada colaborador em dias de folga (negativo = devendo), com o extrato ao clicar. */
export function BalanceTable({ people, canEdit }: { people: Person[]; canEdit: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"todos" | "devendo" | "saldo" | "movimento">("movimento");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .filter((p) => (only === "devendo" ? p.balance < 0 : only === "saldo" ? p.balance > 0 : only === "movimento" ? p.ledger.length > 0 : true))
      .sort((a, b) => a.balance - b.balance || a.name.localeCompare(b.name, "pt-BR"));
  }, [people, query, only]);

  const open = people.find((p) => p.collaboratorId === openId) ?? null;

  function remove(id: string) {
    if (!window.confirm("Apagar este lançamento do banco de horas?")) return;
    start(async () => {
      const res = await deleteBankEntryAction(id);
      if (res.ok) {
        toast.success("Lançamento apagado.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Saldo por colaborador</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar colaborador…"
              className="h-9 w-56 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground"
            />
            <div className="flex overflow-hidden rounded-md border border-border-strong">
              {(
                [
                  ["movimento", "Com movimento"],
                  ["saldo", "Com saldo"],
                  ["devendo", "Devendo"],
                  ["todos", "Todos"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOnly(key)}
                  className={only === key ? "bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground" : "bg-surface px-3 py-1.5 text-xs font-medium text-foreground-subtle hover:bg-surface-muted"}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-border bg-surface-muted text-left text-xs text-foreground-subtle">
                <th className="px-4 py-2 font-semibold">Colaborador</th>
                <th className="px-3 py-2 font-semibold">Turno</th>
                <th className="px-3 py-2 text-right font-semibold">Créditos</th>
                <th className="px-3 py-2 text-right font-semibold">Folgas usadas</th>
                <th className="px-4 py-2 text-right font-semibold">Saldo (dias)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-foreground-subtle">
                    Ninguém nesse filtro.
                  </td>
                </tr>
              )}
              {rows.map((p) => (
                <tr key={p.collaboratorId} className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted" onClick={() => setOpenId(p.collaboratorId)}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-foreground">{p.name}</p>
                    {p.functionName && <p className="text-xs text-foreground-subtle">{p.functionName}</p>}
                  </td>
                  <td className="px-3 py-2 text-foreground-subtle">{p.turnoName ? `Turno ${p.turnoName}` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">{fmt(p.credits)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground-muted">{fmt(p.debits)}</td>
                  <td className="px-4 py-2 text-right">
                    {p.balance < 0 ? (
                      <Badge tone="danger">Devendo {fmt(Math.abs(p.balance))}</Badge>
                    ) : p.balance > 0 ? (
                      <Badge tone="success">{fmt(p.balance)}</Badge>
                    ) : (
                      <Badge tone="neutral">0</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.name}</DialogTitle>
                <DialogDescription>
                  Saldo: <strong className={open.balance < 0 ? "text-danger" : "text-foreground"}>{open.balance < 0 ? `devendo ${fmt(Math.abs(open.balance))}` : fmt(open.balance)} dia(s)</strong> · {fmt(open.credits)} crédito(s) · {fmt(open.debits)} usado(s)
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
                {canEdit && (
                  <div>
                    <ManualEntryDialog collaborators={[{ id: open.collaboratorId, name: open.name }]} presetId={open.collaboratorId} />
                  </div>
                )}
                {open.ledger.length === 0 && <p className="text-sm text-foreground-subtle">Sem lançamentos ainda.</p>}
                <ul className="flex flex-col gap-2">
                  {open.ledger.map((l, i) => (
                    <li key={l.id ?? `n${i}`} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {br(l.date)} — {l.label}
                        </p>
                        {l.note && <p className="text-xs text-foreground-subtle">{l.note}</p>}
                        {l.by && <p className="text-[11px] text-foreground-subtle">Lançado por {l.by}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={l.days < 0 ? "font-semibold tabular-nums text-danger" : "font-semibold tabular-nums text-success"}>
                          {l.days > 0 ? "+" : ""}
                          {fmt(l.days)}
                        </span>
                        {l.removable && l.id && canEdit && (
                          <Button size="icon" variant="ghost" aria-label="Apagar lançamento" disabled={pending} onClick={() => remove(l.id!)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
