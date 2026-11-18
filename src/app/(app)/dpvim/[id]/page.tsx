import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Camera, Users } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getDpvimDetail } from "@/server/services/dpvim.service";
import { dpvimKindLabel, formatHours } from "@/domain/dpvim/rules";
import { LinesTable } from "../lines-table";
import { attachmentUrl } from "@/lib/attachment-url";
import { formatDateTime } from "@/lib/dates";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DpvimFormDialog } from "../dpvim-form-dialog";
import { StartDpvimDialog } from "../start-dialog";
import { StopDpvimDialog } from "../stop-dialog";
import { CancelDpvimButton } from "../cancel-button";
import { DeleteDpvimButton } from "../delete-button";
import { InvoiceQtyDialog } from "../invoice-dialog";
import { ProgressBar, SituationBadge } from "../situation-badge";

function toLocalInput(d: Date): string {
  const f = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return f.replace(" ", "T");
}

export default async function DpvimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const detail = await getDpvimDetail(user, id).catch(() => null);
  if (!detail) notFound();
  const { row, sessions } = detail;
  const open = row.status === "ABERTA" || row.status === "EM_ANDAMENTO";
  const canStart = open && detail.hasCollaborator && !detail.mySession;
  const left = Math.max(0, row.expectedQty - row.doneQty);
  const over = Math.max(0, row.doneQty - row.expectedQty);
  const stopLines = row.lines.map((l) => ({ kind: l.kind, label: dpvimKindLabel(l.kind, detail.kinds), expected: l.expected }));

  return (
    <>
      <PageHeader
        title={row.code}
        description={`${row.lines.map((l) => dpvimKindLabel(l.kind, detail.kinds)).join(" + ")} · de ${row.origin}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/dpvim">
                <ChevronLeft className="size-4" /> Todas as DPVIM
              </Link>
            </Button>
            {detail.mySession && <StopDpvimDialog sessionId={detail.mySession.id} code={row.code} lines={stopLines} />}
            {canStart && <StartDpvimDialog dpvimId={row.id} code={row.code} collaborators={detail.collaborators} myCollaboratorId={detail.myCollaboratorId} size="md" />}
          </div>
        }
      />
      <PageBody className="flex flex-col gap-6">
        <Card>
          <CardContent className="grid grid-cols-1 gap-5 pt-5 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-foreground-subtle">Prazo (48h da chegada)</p>
              <SituationBadge situation={row.situation} hoursLeft={row.hoursLeft} />
              <p className="text-sm text-foreground">
                Chegou {formatDateTime(row.arrivedAt)}
                <br />
                Vence {formatDateTime(row.dueAt)}
                {row.finishedAt && (
                  <>
                    <br />
                    Concluída {formatDateTime(row.finishedAt)} ({formatHours((row.finishedAt.getTime() - row.arrivedAt.getTime()) / 3600000)} depois da chegada)
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-foreground-subtle">Andamento</p>
              <ProgressBar done={row.doneQty} expected={row.expectedQty} progress={row.progress} />
              <p className="text-sm text-foreground">
                {left > 0 ? `Faltam cerca de ${left} pelo norte do conferente` : over > 0 ? `Já passou ${over} do norte do conferente` : "No norte do conferente"}
              </p>
              {row.balance !== null && (
                <p className={row.balance === 0 ? "text-sm font-semibold text-success" : row.balance < 0 ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-warning"}>
                  {row.balance === 0 ? "Conferência: bateu com a nota" : row.balance < 0 ? `Divergência: faltou ${-row.balance} em relação à nota` : `Divergência: sobrou ${row.balance} em relação à nota`}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-xs text-foreground-subtle">Carga</p>
              {row.reference && <p>Número / nota / placa: <strong>{row.reference}</strong></p>}
              {row.material && <p>Materiais: {row.material}</p>}
              {row.notes && <p className="whitespace-pre-wrap text-foreground-muted">{row.notes}</p>}
              {!row.reference && !row.material && !row.notes && <p className="text-foreground-subtle">Sem mais detalhes.</p>}
              {row.status === "CANCELADA" && <Badge tone="neutral">Cancelada</Badge>}
            </div>
          </CardContent>
          {detail.canLaunch && (
            <CardContent className="flex flex-wrap gap-2 border-t border-border pt-4">
              <DpvimFormDialog
                kinds={detail.kinds}
                suppliers={detail.suppliers}
                suppliersReady={detail.suppliersReady}
                initial={{
                  id: row.id,
                  origin: row.origin,
                  reference: row.reference ?? "",
                  material: row.material ?? "",
                  items: row.lines.filter((l) => l.expected > 0).map((l) => ({ kind: l.kind, qty: l.expected })),
                  arrivedLocal: toLocalInput(row.arrivedAt),
                  notes: row.notes ?? "",
                }}
              />
              {row.status !== "CONCLUIDA" && <CancelDpvimButton id={row.id} cancelled={row.status === "CANCELADA"} />}
              {detail.canManage && <DeleteDpvimButton id={row.id} code={row.code} />}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos desta DPVIM</CardTitle>
            <CardDescription>
              O norte é a contagem do conferente na chegada, só uma referência. O que vale é o que os ajudantes contarem{detail.canSeeInvoice ? ", comparado com a nota" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <LinesTable lines={row.lines} kinds={detail.kinds} canSeeInvoice={detail.canSeeInvoice} concluded={row.status === "CONCLUIDA"} />
            {detail.canSeeInvoice && row.status !== "CANCELADA" && (
              <div>
                <InvoiceQtyDialog key={row.lines.map((l) => `${l.kind}:${l.invoice}`).join("|")} id={row.id} code={row.code} lines={row.lines.map((l) => ({ kind: l.kind, label: dpvimKindLabel(l.kind, detail.kinds), invoice: l.invoice }))} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" /> Quem abriu e quando ({sessions.length})
            </CardTitle>
            <CardDescription>Cada vez que alguém abre a DPVIM e trabalha nela fica registrado, com a foto de confirmação.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {sessions.length === 0 && <p className="text-sm text-foreground-subtle">Ninguém abriu essa DPVIM ainda.</p>}
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row">
                <a href={attachmentUrl(s.photoPath)} target="_blank" rel="noopener noreferrer" className="relative block h-28 w-full shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted sm:w-36" title="Foto de confirmação">
                  {/* eslint-disable-next-line @next/next/no-img-element -- servida pela rota autenticada /api/uploads */}
                  <img src={attachmentUrl(s.photoPath)} alt="Foto de confirmação da abertura" className="size-full object-cover" />
                  <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    <Camera className="size-3" /> foto
                  </span>
                </a>
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <p className="font-semibold text-foreground">
                    {s.workerName}
                    {s.partnerName ? <span className="font-normal text-foreground-muted"> + {s.partnerName}</span> : null}
                  </p>
                  <p className="text-foreground-muted">
                    Abriu em <strong>{formatDateTime(s.startedAt)}</strong>
                  </p>
                  {s.stoppedAt ? (
                    <>
                      <p className="text-foreground-muted">
                        Parou em <strong>{formatDateTime(s.stoppedAt)}</strong> ({formatHours((s.stoppedAt.getTime() - s.startedAt.getTime()) / 3600000)} de atividade)
                      </p>
                      <p className="text-foreground">
                        Fez <strong>{s.qtyDone ?? 0}</strong> item(ns)
                        {s.byKind.length > 1 && !s.byKind.some((b) => b.good !== null) ? <span className="text-foreground-subtle"> ({s.byKind.map((b) => `${dpvimKindLabel(b.kind, detail.kinds)} ${b.qty}`).join(" · ")})</span> : null}
                        {!s.byKind.some((b) => b.good !== null) && (s.qtyGood !== null || s.qtyTransfer !== null || s.qtyDiscard !== null) ? (
                          <span className="text-foreground-subtle">
                            {" "}
                            · bons {s.qtyGood ?? 0} · transferência {s.qtyTransfer ?? 0} · descarte {s.qtyDiscard ?? 0}
                          </span>
                        ) : null}
                      </p>
                      {s.byKind.some((b) => b.good !== null) && (
                        <ul className="flex flex-col gap-0.5 text-xs text-foreground-subtle">
                          {s.byKind.map((b) => (
                            <li key={b.kind}>
                              <strong className="text-foreground">{dpvimKindLabel(b.kind, detail.kinds)} {b.qty}</strong>
                              {b.good !== null ? ` · bons ${b.good} · transferência ${b.transfer ?? 0} · descarte ${b.discard ?? 0}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      {s.notes && <p className="text-xs text-foreground-subtle">{s.notes}</p>}
                    </>
                  ) : (
                    <Badge tone="accent" dot>
                      Em andamento agora
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
