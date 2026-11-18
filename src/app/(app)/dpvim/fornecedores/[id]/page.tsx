import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { canManageDpvim, getDpvimSupplierDetail } from "@/server/services/dpvim.service";
import { dpvimKindLabel, formatHours } from "@/domain/dpvim/rules";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SituationBadge } from "../../situation-badge";

const n = (v: number) => v.toLocaleString("pt-BR");

const DOT: Record<string, string> = {
  neutral: "bg-foreground-subtle",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  accent: "bg-accent",
};

export default async function DpvimSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageDpvim(user)) redirect("/dpvim");
  const d = await getDpvimSupplierDetail(user, id);
  if (!d) notFound();
  const { supplier: s, stats: k } = d;

  return (
    <>
      <PageHeader
        title={s.label}
        description={`Fornecedor da DPVIM · ${s.createdBy ? `cadastrado por ${s.createdBy} em ` : "cadastrado em "}${formatDateTime(s.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Ativo" : "Desativado"}</Badge>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dpvim/fornecedores">
                <ChevronLeft className="size-4" /> Todos os fornecedores
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="DPVIM" value={k.total} hint={`${k.concluded} finalizadas`} />
          <StatCard label="Em aberto" value={k.open} tone="neutral" />
          <StatCard label="Atrasadas" value={k.late} tone={k.late > 0 ? "danger" : "success"} />
          <StatCard label="Rebatidas no prazo" value={k.onTimeRate === null ? "—" : `${k.onTimeRate}%`} tone={k.onTimeRate === null ? "neutral" : k.onTimeRate >= 90 ? "success" : k.onTimeRate >= 70 ? "warning" : "danger"} />
          <StatCard label="Tempo médio para rebater" value={k.avgLeadHours === null ? "—" : formatHours(k.avgLeadHours)} hint="da chegada à conclusão" />
        </div>

        {d.canSeeInvoice && (
          <Card>
            <CardHeader>
              <CardTitle>Saldo da nota × contagem</CardTitle>
              <CardDescription>Por produto, somando todas as DPVIM deste fornecedor: o que sobrou numa abate o que faltou na outra.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {d.balance && d.balance.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {d.balance.map((b) => (
                    <div key={b.kind} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="font-medium text-foreground">{dpvimKindLabel(b.kind, d.kinds)}</p>
                      {b.balance < 0 ? <strong className="text-danger">Faltam {n(-b.balance)}</strong> : b.balance > 0 ? <strong className="text-warning">Sobram {n(b.balance)}</strong> : <strong className="text-success">Saldo zerado</strong>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground-subtle">Nenhuma DPVIM finalizada com a nota informada ainda.</p>
              )}
              {d.awaitingInvoice > 0 && <p className="text-xs text-warning">{d.awaitingInvoice === 1 ? "1 DPVIM ainda espera" : `${d.awaitingInvoice} DPVIM ainda esperam`} a quantidade da nota.</p>}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>DPVIM deste fornecedor ({d.rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-y border-border bg-surface-muted text-left text-xs text-foreground-subtle">
                      <th className="px-4 py-2 font-semibold">DPVIM</th>
                      <th className="px-3 py-2 font-semibold">Chegou</th>
                      <th className="px-3 py-2 font-semibold">Prazo</th>
                      {d.canSeeInvoice && <th className="px-3 py-2 font-semibold">Nota</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-foreground-subtle">
                          Nenhuma DPVIM deste fornecedor ainda.
                        </td>
                      </tr>
                    )}
                    {d.rows.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                        <td className="px-4 py-2.5">
                          <Link href={`/dpvim/${r.id}`} className="font-semibold text-accent hover:underline">
                            {r.code}
                          </Link>
                          <p className="text-xs text-foreground-subtle">{r.lines.map((l) => `${dpvimKindLabel(l.kind, d.kinds)} ${l.expected}`).join(" + ")}</p>
                          <p className="text-[11px] text-foreground-subtle">cadastrada por {r.createdByName}</p>
                        </td>
                        <td className="px-3 py-2.5 text-foreground-subtle">{formatDateTime(r.arrivedAt)}</td>
                        <td className="px-3 py-2.5">
                          <SituationBadge situation={r.situation} hoursLeft={r.hoursLeft} />
                        </td>
                        {d.canSeeInvoice && (
                          <td className="px-3 py-2.5 text-xs">
                            {r.lines.some((l) => l.invoice === null) ? (
                              <Badge tone="warning">Falta lançar a nota</Badge>
                            ) : r.balance === null ? (
                              <span className="text-foreground-subtle">aguarda finalizar</span>
                            ) : r.balance === 0 ? (
                              <Badge tone="success">Bateu</Badge>
                            ) : (
                              <span className={cn("font-semibold", r.balance < 0 ? "text-danger" : "text-warning")}>{r.balance < 0 ? `Faltou ${n(-r.balance)}` : `Sobrou ${n(r.balance)}`}</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Linha do tempo</CardTitle>
              <CardDescription>Cadastro e alterações do fornecedor, e o que aconteceu em cada DPVIM dele: quem cadastrou, abriu, finalizou e lançou a nota.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col">
                {d.timeline.map((e, i) => (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className="flex flex-col items-center">
                      <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT[e.tone])} />
                      {i < d.timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="text-foreground">
                        {e.href ? (
                          <Link href={e.href} className="hover:underline">
                            {e.text}
                          </Link>
                        ) : (
                          e.text
                        )}
                      </p>
                      <p className="text-xs text-foreground-subtle">
                        {formatDateTime(e.at)}
                        {e.by ? ` · ${e.by}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
