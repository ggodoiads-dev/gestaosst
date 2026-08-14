import Link from "next/link";
import { ClipboardCheck, CheckCircle2, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listChecklistBoardForUser } from "@/server/services/checklist-execution.service";
import { getColaboradorSummary, getGestaoSummary } from "@/server/services/indicators.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/dates";

export default async function EquipamentosPainelPage() {
  const user = await requireUser();
  const isGestao =
    hasPermission(user, PERMISSIONS.INDICATORS_VIEW_AREA) ||
    hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED);

  if (isGestao) {
    return <GestaoHome />;
  }
  return <ColaboradorHome />;
}

async function ColaboradorHome() {
  const user = await requireUser();
  const [summary, board] = await Promise.all([
    getColaboradorSummary(user),
    listChecklistBoardForUser(user),
  ]);

  const pendentes = board.filter((b) => b.situation === "PENDENTE" || b.situation === "ATRASADO");

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} description="Aqui está o que você precisa fazer hoje." />
      <PageBody>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Previstos hoje" value={summary.previstos} icon={<ClipboardCheck />} />
          <StatCard label="Realizados" value={summary.realizados} tone="success" icon={<CheckCircle2 />} />
          <StatCard label="Pendentes" value={summary.pendentes} tone="warning" icon={<Clock />} />
          <StatCard label="Atrasados" value={summary.atrasados} tone="danger" icon={<AlertTriangle />} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Seus próximos checklists</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendentes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-foreground-subtle">
                Nenhum checklist pendente. Tudo em dia.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {pendentes.map((item) => (
                  <Link
                    key={item.equipment.id}
                    href={`/checklist/realizar/${item.equipment.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {item.equipment.code} — {item.equipment.name}
                      </p>
                      <p className="text-xs text-foreground-subtle">
                        {item.equipment.area.name}
                        {item.scheduledFor && <> · previsto {formatTime(item.scheduledFor)}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={item.situation === "ATRASADO" ? "danger" : "neutral"} dot>
                        {item.situation === "ATRASADO" ? "Atrasado" : "Pendente"}
                      </Badge>
                      <ChevronRight className="size-4 text-foreground-subtle" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

async function GestaoHome() {
  const user = await requireUser();
  const summary = await getGestaoSummary(user);

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(" ")[0]}`} description="Situação atual da operação." />
      <PageBody>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle mb-2.5">
            Checklists de hoje
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Previstos" value={summary.previstos} href="/checklist/realizar" />
            <StatCard label="Realizados" value={summary.realizados} tone="success" href="/checklist/realizar" />
            <StatCard label="Pendentes" value={summary.pendentes} tone="warning" href="/checklist/realizar" />
            <StatCard label="Atrasados" value={summary.atrasados} tone="danger" href="/checklist/realizar" />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle mb-2.5">
            Equipamentos
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatCard label="Liberados" value={summary.equipamentosLiberados} tone="success" href="/equipamentos?status=LIBERADO" />
            <StatCard label="Com observação" value={summary.equipamentosObservacao} tone="info" href="/equipamentos?status=LIBERADO_COM_OBSERVACAO" />
            <StatCard label="Restritos" value={summary.equipamentosRestritos} tone="warning" href="/equipamentos?status=RESTRITO" />
            <StatCard label="Bloqueados" value={summary.equipamentosBloqueados} tone="danger" href="/equipamentos?status=BLOQUEADO" />
            <StatCard label="Em manutenção" value={summary.equipamentosManutencao} href="/equipamentos?status=EM_MANUTENCAO" />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle mb-2.5">
            Não conformidades e ações
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="NCs abertas" value={summary.ncAbertas} tone="warning" href="/nao-conformidades" />
            <StatCard label="NCs críticas" value={summary.ncCriticas} tone="danger" href="/nao-conformidades?severity=CRITICA" />
            <StatCard label="NCs vencidas" value={summary.ncVencidas} tone="danger" href="/nao-conformidades?overdue=true" />
            <StatCard label="Ações vencidas" value={summary.acoesVencidas} tone="danger" href="/planos-de-acao?overdue=true" />
          </div>
        </div>
      </PageBody>
    </>
  );
}
