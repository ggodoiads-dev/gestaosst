import Link from "next/link";
import { CheckCircle2, ChevronRight, Scale } from "lucide-react";
import { dpvimKindLabel, type DpvimKindOption } from "@/domain/dpvim/rules";
import type { DpvimDivergenceSummary } from "@/server/services/dpvim.service";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceQtyDialog } from "./invoice-dialog";

const STATUS_LABEL: Record<string, string> = { ABERTA: "Aguardando começar", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Finalizada", CANCELADA: "Cancelada" };

const n = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** O que faltou ou sobrou entre a nota e a contagem dos ajudantes, produto a produto: o total, quem mais deixa faltar e quais DPVIM fecharam diferentes. */
export function DivergenceSection({ data, kinds }: { data: DpvimDivergenceSummary; kinds: DpvimKindOption[] }) {
  const kindName = (k: string) => dpvimKindLabel(k, kinds);
  const withIssue = data.bySupplier.filter((s) => s.withDivergence > 0);
  const clean = data.bySupplier.length - withIssue.length;
  const maxMissing = Math.max(1, ...withIssue.map((s) => s.missing));
  const kindsWithIssue = data.byKind;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" /> Divergências: nota × contagem dos ajudantes
        </CardTitle>
        <CardDescription>
          Compara, produto a produto, a quantidade da nota com o que os ajudantes contaram. O saldo soma todas as DPVIM do mesmo produto: o que sobrou numa abate o que faltou na outra. Só entram as DPVIM já finalizadas e com a nota informada. O norte do conferente não entra na conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {data.awaitingInvoice.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft/40 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {data.awaitingInvoice.length === 1 ? "1 DPVIM ainda espera a quantidade da nota" : `${data.awaitingInvoice.length} DPVIM ainda esperam a quantidade da nota`}
              </p>
              <p className="text-xs text-foreground-subtle">Quem recebe e conta não vê a nota. Enquanto a nota não é lançada, a DPVIM não entra na conferência. As já finalizadas vêm primeiro.</p>
            </div>
            <ul className="flex flex-col gap-2">
              {data.awaitingInvoice.slice(0, 15).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/dpvim/${a.id}`} className="font-semibold text-accent hover:underline">
                      {a.code}
                    </Link>
                    <span className="text-foreground">{a.origin}</span>
                    <Badge tone={a.status === "CONCLUIDA" ? "success" : "neutral"}>{STATUS_LABEL[a.status] ?? a.status}</Badge>
                    <span className="text-xs text-foreground-subtle">falta a nota de {a.lines.filter((l) => l.invoice === null).map((l) => kindName(l.kind)).join(", ")}</span>
                  </span>
                  <InvoiceQtyDialog key={a.lines.map((l) => `${l.kind}:${l.invoice}`).join("|")} id={a.id} code={a.code} lines={a.lines.map((l) => ({ kind: l.kind, label: kindName(l.kind), invoice: l.invoice }))} />
                </li>
              ))}
            </ul>
            {data.awaitingInvoice.length > 15 && <p className="text-xs text-foreground-subtle">Mostrando 15 de {data.awaitingInvoice.length}. Use o filtro &ldquo;Falta lançar a nota&rdquo; na fila abaixo para ver todas.</p>}
          </div>
        )}

        {data.checked === 0 ? (
          <p className="text-sm text-foreground-subtle">Ainda não há DPVIM finalizada e com a nota informada nesse filtro para conferir.</p>
        ) : data.withDivergence === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success-soft px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-5 shrink-0" />
            <span>Todas as {data.checked} DPVIM conferidas bateram com a nota. Nenhuma divergência.</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-danger/30 bg-danger-soft/40 px-4 py-3">
                <p className="text-xs font-medium text-foreground-subtle">Faltam no saldo</p>
                <p className="text-3xl font-bold tabular-nums text-danger">{n(data.missing)}</p>
                <p className="text-xs text-foreground-subtle">{data.missingRate !== null ? `${pct(data.missingRate)} do que veio nas notas (${n(data.invoiced)})` : "itens"}</p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs font-medium text-foreground-subtle">Sobram no saldo</p>
                <p className={data.surplus > 0 ? "text-3xl font-bold tabular-nums text-warning" : "text-3xl font-bold tabular-nums text-foreground-subtle"}>{n(data.surplus)}</p>
                <p className="text-xs text-foreground-subtle">contado a mais do que a nota diz, já abatidas as faltas do mesmo produto</p>
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

            {kindsWithIssue.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">Saldo por tipo de produto</h3>
                <div className="flex flex-wrap gap-2">
                  {kindsWithIssue.map((k) => (
                    <div key={k.kind} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="font-medium text-foreground">{kindName(k.kind)}</p>
                      <p className="text-xs tabular-nums text-foreground-subtle">
                        {k.balance < 0 ? (
                          <strong className="text-danger">Faltam {n(-k.balance)}</strong>
                        ) : k.balance > 0 ? (
                          <strong className="text-warning">Sobram {n(k.balance)}</strong>
                        ) : (
                          <strong className="text-success">Saldo zerado</strong>
                        )}
                        {` · nota ${n(k.invoiced)}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">Por fornecedor (de onde veio)</h3>
              <ul className="flex flex-col gap-2">
                {withIssue.map((s) => (
                  <li key={s.origin}>
                    <details className="group rounded-lg border border-border">
                      <summary className="flex cursor-pointer list-none flex-col gap-1.5 px-3 py-2.5 hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            <ChevronRight className="size-4 shrink-0 text-foreground-subtle transition-transform group-open:rotate-90" />
                            {s.origin}
                          </span>
                          <span className="text-sm tabular-nums">
                            {s.byKind.filter((b) => b.balance !== 0).length === 0 ? (
                              <strong className="text-success">Saldo zerado</strong>
                            ) : (
                              s.byKind
                                .filter((b) => b.balance !== 0)
                                .map((b, i) => (
                                  <span key={b.kind}>
                                    {i > 0 && <span className="text-foreground-subtle"> · </span>}
                                    <strong className={b.balance < 0 ? "text-danger" : "text-warning"}>
                                      {kindName(b.kind)}: {b.balance < 0 ? `faltam ${n(-b.balance)}` : `sobram ${n(b.balance)}`}
                                    </strong>
                                  </span>
                                ))
                            )}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full rounded-full bg-danger" style={{ width: `${Math.round((s.missing / maxMissing) * 100)}%` }} />
                        </div>
                        <p className="text-xs text-foreground-subtle">
                          {s.withDivergence} de {s.count} DPVIM com divergência
                          {s.missing > 0 && s.invoiced > 0 ? ` · no saldo faltam ${pct((s.missing / s.invoiced) * 100)} do que veio na nota (${n(s.invoiced)})` : ""}
                          {" · "}
                          <span className="text-accent">clique para ver as {s.dpvims.length} DPVIM</span>
                        </p>
                      </summary>
                      <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
                        {s.dpvims.map((d) => (
                          <div key={d.id} className="flex flex-col gap-1 rounded-md border border-border px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="flex flex-wrap items-center gap-2">
                                <Link href={`/dpvim/${d.id}`} className="font-semibold text-accent hover:underline">
                                  {d.code}
                                </Link>
                                <Badge tone={d.status === "CONCLUIDA" ? "success" : "neutral"}>{STATUS_LABEL[d.status] ?? d.status}</Badge>
                              </span>
                              <span className="text-xs text-foreground-subtle">chegou {formatDateTime(d.arrivedAt)}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {d.lines.map((l) => (
                                <div key={l.kind} className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="min-w-24 text-foreground">{kindName(l.kind)}</span>
                                  <span className="tabular-nums text-foreground-subtle">{l.invoiced === null ? `contado ${n(l.counted)}` : `${n(l.invoiced)} → ${n(l.counted)}`}</span>
                                  {l.invoiced === null ? (
                                    <Badge tone="warning">Falta lançar a nota</Badge>
                                  ) : l.balance === null ? (
                                    <span className="text-foreground-subtle">aguarda finalizar</span>
                                  ) : l.balance === 0 ? (
                                    <Badge tone="success">Bateu</Badge>
                                  ) : (
                                    <Badge tone={l.balance < 0 ? "danger" : "warning"}>{l.balance < 0 ? `Faltou ${n(-l.balance)}` : `Sobrou ${n(l.balance)}`}</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
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
                      <th className="px-3 py-2 font-semibold">Produto: nota → contado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.slice(0, 20).map((i) => (
                      <tr key={i.id} className="border-t border-border align-top hover:bg-surface-muted">
                        <td className="px-3 py-2">
                          <Link href={`/dpvim/${i.id}`} className="font-semibold text-accent hover:underline">
                            {i.code}
                          </Link>
                          {i.finishedAt && <p className="text-[11px] text-foreground-subtle">finalizada {formatDateTime(i.finishedAt)}</p>}
                        </td>
                        <td className="px-3 py-2 text-foreground">{i.origin}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            {i.lines.map((l) => (
                              <div key={l.kind} className="flex flex-wrap items-center gap-2">
                                <span className="min-w-24 text-foreground">{kindName(l.kind)}</span>
                                <span className="text-xs tabular-nums text-foreground-subtle">
                                  {n(l.invoiced)} → {n(l.counted)}
                                </span>
                                {l.balance === 0 ? (
                                  <Badge tone="success">Bateu</Badge>
                                ) : (
                                  <Badge tone={l.balance < 0 ? "danger" : "warning"}>{l.balance < 0 ? `Faltou ${n(-l.balance)}` : `Sobrou ${n(l.balance)}`}</Badge>
                                )}
                              </div>
                            ))}
                          </div>
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
