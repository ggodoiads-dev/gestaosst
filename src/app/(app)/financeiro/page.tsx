import Link from "next/link";
import { Wrench, Wallet, Calculator, Info } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getFinanceSummary } from "@/server/services/finance.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { EquipmentDamageStatusBadge } from "@/components/domain/status-badges";
import { formatDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

export default async function FinanceiroPage() {
  const user = await requireUser();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { damageCost, payroll } = await getFinanceSummary(user, { from, to });

  const showEmpty = !damageCost && !payroll;
  const combinedTotal = (payroll?.totalMonthly ?? 0) + (damageCost?.totalCost ?? 0);

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Consolidação do custo que o sistema já conhece — nada é lançado manualmente aqui, cada número tem origem numa tela específica e pode ser conferido linha a linha."
      />
      <PageBody>
        {showEmpty && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-foreground-subtle">
              Você não tem acesso a nenhuma fonte de custo consolidada aqui ainda.
            </CardContent>
          </Card>
        )}

        {(payroll || damageCost) && (
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><Calculator className="size-4" /> Resumo — {monthLabel}</span>
              </CardTitle>
              <CardDescription>Soma simples das fontes abaixo. Cada uma é detalhada na sua própria seção.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                {payroll && (
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="flex items-center gap-2 text-foreground-subtle">
                      <Wallet className="size-3.5" /> Folha de pagamento
                    </span>
                    <span className="font-medium tabular-nums text-foreground">{formatCurrency(payroll.totalMonthly)}</span>
                  </div>
                )}
                {damageCost && (
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="flex items-center gap-2 text-foreground-subtle">
                      <Wrench className="size-3.5" /> Avarias de frota no mês
                    </span>
                    <span className="font-medium tabular-nums text-foreground">{formatCurrency(damageCost.totalCost)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 text-sm bg-surface-muted">
                  <span className="font-semibold text-foreground">Total consolidado</span>
                  <span className="text-lg font-semibold tabular-nums text-foreground">{formatCurrency(combinedTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {payroll && (
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><Wallet className="size-4" /> Folha de pagamento</span>
              </CardTitle>
              <CardDescription>
                Soma do campo Salário de cada colaborador ativo, cadastrado em{" "}
                <Link href="/colaboradores" className="text-accent hover:underline">Colaboradores</Link> (dado de RH).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs text-foreground-subtle">Custo mensal estimado</p>
                  <p className="text-2xl font-semibold text-foreground tabular-nums">{formatCurrency(payroll.totalMonthly)}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-subtle">Colaboradores com salário cadastrado</p>
                  <p className="text-lg font-semibold tabular-nums">{payroll.collaboratorsWithSalary}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-subtle">Sem salário cadastrado</p>
                  <p className={`text-lg font-semibold tabular-nums ${payroll.collaboratorsWithoutSalary > 0 ? "text-warning" : "text-success"}`}>
                    {payroll.collaboratorsWithoutSalary}
                  </p>
                </div>
              </div>
              {payroll.collaboratorsWithoutSalary > 0 && (
                <p className="flex items-start gap-1.5 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                  <Info className="size-3.5 shrink-0 mt-0.5" />
                  {payroll.collaboratorsWithoutSalary} colaborador(es) ativo(s) não têm salário cadastrado e por isso não entram
                  nessa soma — o valor real da folha é maior que o mostrado aqui.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {damageCost && (
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><Wrench className="size-4" /> Avarias de frota — {monthLabel}</span>
              </CardTitle>
              <CardDescription>
                Soma do campo Valor de cada avaria com data neste mês, registrada em{" "}
                <Link href="/frota" className="text-accent hover:underline">Frota</Link>. Cada linha da tabela abaixo é uma
                avaria — é daí que o total vem.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-foreground-subtle">Custo total no mês</p>
                  <p className="text-2xl font-semibold text-foreground tabular-nums">{formatCurrency(damageCost.totalCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-subtle">Avarias no mês</p>
                  <p className="text-lg font-semibold tabular-nums">{damageCost.totalCount}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-subtle">Ainda em aberto</p>
                  <p className={`text-lg font-semibold tabular-nums ${damageCost.openCount > 0 ? "text-warning" : "text-success"}`}>
                    {damageCost.openCount}
                  </p>
                </div>
              </div>

              {damageCost.withoutCostCount > 0 && (
                <p className="flex items-start gap-1.5 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                  <Info className="size-3.5 shrink-0 mt-0.5" />
                  {damageCost.withoutCostCount} avaria(s) deste mês ainda não têm valor lançado e por isso entram como R$ 0,00
                  nessa soma — edite a avaria em Frota assim que souber o valor pra ela contar aqui.
                </p>
              )}

              {damageCost.byEquipment.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-foreground-subtle">Total por equipamento</p>
                  {damageCost.byEquipment.map((e) => (
                    <div key={e.equipmentId} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span>{e.equipmentCode} — {e.equipmentName}</span>
                      <span className="flex items-center gap-3 text-foreground-subtle">
                        <span>{e.count} avaria(s)</span>
                        <span className="tabular-nums font-medium text-foreground">{formatCurrency(e.totalCost)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-foreground-subtle">Detalhamento — cada avaria do mês</p>
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {damageCost.items.length === 0 && <TableEmpty colSpan={6} />}
                      {damageCost.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">
                            <Link href={`/frota/${item.id}`} className="text-accent hover:underline">{item.code}</Link>
                          </TableCell>
                          <TableCell className="text-foreground-subtle">{formatDate(item.date)}</TableCell>
                          <TableCell>{item.equipmentCode} — {item.equipmentName}</TableCell>
                          <TableCell className="text-foreground-subtle">{item.collaboratorName ?? "Não apurado"}</TableCell>
                          <TableCell><EquipmentDamageStatusBadge status={item.status} /></TableCell>
                          <TableCell className="tabular-nums">
                            {item.cost === null ? <span className="text-warning">Sem valor</span> : formatCurrency(item.cost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
