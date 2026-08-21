import Link from "next/link";
import { Wrench, Wallet } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getFinanceSummary } from "@/server/services/finance.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

export default async function FinanceiroPage() {
  const user = await requireUser();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { damageCost, payroll } = await getFinanceSummary(user, { from, to });

  const showEmpty = !damageCost && !payroll;

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Consolidação do custo que o sistema já conhece — sem lançamento manual, é o que já está registrado em outras telas."
      />
      <PageBody>
        {showEmpty && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-foreground-subtle">
              Você não tem acesso a nenhuma fonte de custo consolidada aqui ainda.
            </CardContent>
          </Card>
        )}

        {payroll && (
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2"><Wallet className="size-4" /> Folha de pagamento</span>
              </CardTitle>
              <CardDescription>Soma do salário cadastrado dos colaboradores ativos hoje.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
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
                Custo registrado em <Link href="/frota" className="text-accent hover:underline">Frota</Link> no mês atual.
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

              {damageCost.byEquipment.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-foreground-subtle">Por equipamento</p>
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
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
