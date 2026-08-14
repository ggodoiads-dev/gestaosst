import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import {
  getGestaoSummary,
  getDesempenhoPorArea,
  getTopProblemEquipments,
  getTopFaultCategories,
} from "@/server/services/indicators.service";
import { getEquipmentRiskRanking } from "@/server/services/risk-score.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function riskTone(score: number): "success" | "warning" | "danger" {
  if (score > 60) return "danger";
  if (score > 30) return "warning";
  return "success";
}

export default async function IndicadoresPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.INDICATORS_VIEW_AREA);

  const [summary, desempenho, topEquipamentos, topFalhas, riskRanking] = await Promise.all([
    getGestaoSummary(user),
    getDesempenhoPorArea(user),
    getTopProblemEquipments(user),
    getTopFaultCategories(user),
    getEquipmentRiskRanking(user),
  ]);

  return (
    <>
      <PageHeader
        title="Indicadores"
        description="Todo indicador é clicável e leva aos registros que o originaram."
      />
      <PageBody>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="% cumprimento hoje"
            value={`${summary.percentualCumprimento}%`}
            tone={summary.percentualCumprimento >= 90 ? "success" : summary.percentualCumprimento >= 70 ? "warning" : "danger"}
            href="/checklist/realizar"
          />
          <StatCard label="NCs abertas" value={summary.ncAbertas} tone="warning" href="/nao-conformidades" />
          <StatCard label="NCs críticas" value={summary.ncCriticas} tone="danger" href="/nao-conformidades?severity=CRITICA" />
          <StatCard label="Ações vencidas" value={summary.acoesVencidas} tone="danger" href="/planos-de-acao?overdue=true" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2"><Sparkles className="size-4 text-accent" /> Painel de Risco (IA)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border p-0">
            {riskRanking.length === 0 && (
              <p className="px-4 py-6 text-sm text-foreground-subtle">Sem dados suficientes ainda.</p>
            )}
            {riskRanking.map((item) => (
              <Link
                key={item.equipmentId}
                href={`/equipamentos/${item.equipmentId}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {item.equipmentCode} — {item.equipmentName}{" "}
                    <span className="text-foreground-subtle">· {item.areaName}</span>
                  </p>
                  {item.latestAiFinding && (
                    <p className="truncate text-xs text-foreground-subtle">🤖 {item.latestAiFinding.summary}</p>
                  )}
                </div>
                <Badge tone={riskTone(item.score)}>{item.score}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desempenho por área</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  <TableHead>Equipamentos com checklist</TableHead>
                  <TableHead>Realizados hoje</TableHead>
                  <TableHead>NCs abertas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {desempenho.length === 0 && <TableEmpty colSpan={4} />}
                {desempenho.map((d) => (
                  <TableRow key={d.areaId}>
                    <TableCell>{d.areaName}</TableCell>
                    <TableCell>{d.totalEquipamentos}</TableCell>
                    <TableCell>{d.realizadosHoje} / {d.totalEquipamentos}</TableCell>
                    <TableCell>{d.ncsAbertas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Equipamentos com mais problemas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {topEquipamentos.length === 0 && (
                <p className="px-4 py-6 text-sm text-foreground-subtle">Sem dados suficientes ainda.</p>
              )}
              {topEquipamentos.map(({ equipment, count }) => (
                <Link
                  key={equipment.id}
                  href={`/equipamentos/${equipment.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface-muted"
                >
                  <span>{equipment.code} — {equipment.name}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tipos de falha mais frequentes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {topFalhas.length === 0 && (
                <p className="px-4 py-6 text-sm text-foreground-subtle">Sem dados suficientes ainda.</p>
              )}
              {topFalhas.map(({ category, count }) => (
                <div key={category.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{category.name}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
