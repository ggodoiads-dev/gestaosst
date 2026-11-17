import Link from "next/link";
import { CheckCircle2, Scale } from "lucide-react";
import { dpvimKindLabel, type DpvimKindOption } from "@/domain/dpvim/rules";
import type { DpvimDivergenceSummary } from "@/server/services/dpvim.service";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const n = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** O que faltou ou sobrou entre a nota e a contagem final, de forma direta: o total, quem mais deixa faltar e quais DPVIM fecharam diferentes. */
export function DivergenceSection({ data, kinds }: { data: DpvimDivergenceSummary; kinds: DpvimKindOption[] }) {
  const withIssue = data.bySupplier.filter((s) => s.missing > 0 || s.surplus > 0);
  const clean = data.bySupplier.length - withIssue.length;
  const maxMissing = Math.max(1, ...withIssue.map((s) => s.missing));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" /> Divergências: nota × contagem
        </CardTitle>
        <CardDescription>Quando a contagem final não bate com a quantidade da nota. Só entram as DPVIM que já foram finalizadas.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {data.checked === 0 ? (
          <p className="text-sm text-foreground-subtle">Ainda não há DPVIM finalizada nesse filtro para comparar com a nota.</p>
        ) : data.withDivergence === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-5 shrink-0" />
            <span>
              Todas as {data.checked} DPVIM finalizadas bateram com a nota. Nenhuma divergência.
            </span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-danger/30 bg-danger-soft/40 px-4 py-3">
                <p className="text-xs font-medium text-foreground-subtle">Faltou no total</p>
                <p className="text-3xl font-bold tabular-nums text-danger">{n(data.missing)}</p>
                <p className="text-xs text-foreground-subtle">{data.missingRate !== null ? `${pct(data.missingRate)} do que veio nas notas (${n(data.invoiced)})` : "itens"}</p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs font-medium text-foreground-subtle">Sobrou no total</p>
                <p className={data.surplus > 0 ? "text-3xl font-bold tabular-nums text-warning" : "text-3xl font-bold tabular-nums text-foreground-subtle"}>{n(data.surplus)}</p>
                <p className="text-xs text-foreground-subtle">veio a mais do que a nota dizia</p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs font-medium text-foreground-subtle">DPVIM com divergência</p>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {data.withDivergence}
                  <span className="text-lg font-medium text-foreground-subtle"> de {data.checked}</span>
                </p>
                <p className="text-xs text-foreground-subtle">{data.checked - data.withDivergence} bateram certinho com a nota</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">Por fornecedor (de onde veio)</h3>
              <ul className="flex flex-col gap-3">
                {withIssue.map((s) => (
                  <li key={s.origin} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium text-foreground">{s.origin}</span>
                      <span className="text-sm tabular-nums">
                        {s.missing > 0 && <strong className="text-danger">Faltou {n(s.missing)}</strong>}
                        {s.missing > 0 && s.surplus > 0 && <span className="text-foreground-subtle"> · </span>}
                        {s.surplus > 0 && <strong className="text-warning">Sobrou {n(s.surplus)}</strong>}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-danger" style={{ width: `${Math.round((s.missing / maxMissing) * 100)}%` }} />
                    </div>
                    <p className="text-xs text-foreground-subtle">
                      {s.withDivergence} de {s.count} DPVIM com divergência
                      {s.missing > 0 && s.invoiced > 0 ? ` · faltou ${pct((s.missing / s.invoiced) * 100)} do que veio na nota (${n(s.invoiced)})` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              {clean > 0 && <p className="text-xs text-foreground-subtle">{clean === 1 ? "1 fornecedor sem nenhuma divergência." : `${clean} fornecedores sem nenhuma divergência.`}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">DPVIM que fecharam diferente da nota</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-surface-muted text-left text-xs text-foreground-subtle">
                      <th className="px-3 py-2 font-semibold">DPVIM</th>
                      <th className="px-3 py-2 font-semibold">Fornecedor</th>
                      <th className="px-3 py-2 text-right font-semibold">Nota</th>
                      <th className="px-3 py-2 text-right font-semibold">Contado</th>
                      <th className="px-3 py-2 font-semibold">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.slice(0, 20).map((i) => (
                      <tr key={i.id} className="border-t border-border hover:bg-surface-muted">
                        <td className="px-3 py-2">
                          <Link href={`/dpvim/${i.id}`} className="font-semibold text-accent hover:underline">
                            {i.code}
                          </Link>
                          <p className="text-[11px] text-foreground-subtle">
                            {dpvimKindLabel(i.kind, kinds)}
                            {i.finishedAt ? ` · finalizada ${formatDateTime(i.finishedAt)}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-foreground">{i.origin}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{n(i.invoiced)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{n(i.counted)}</td>
                        <td className="px-3 py-2">
                          <Badge tone={i.balance < 0 ? "danger" : "warning"}>{i.balance < 0 ? `Faltou ${n(-i.balance)}` : `Sobrou ${n(i.balance)}`}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.items.length > 20 && <p className="text-xs text-foreground-subtle">Mostrando as 20 com maior falta. Use o filtro de datas para ver as outras.</p>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
