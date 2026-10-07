import Link from "next/link";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getAccessOverview } from "@/server/services/access.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "warning" }) {
  return (
    <div>
      <p className="text-xs text-foreground-subtle">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${tone === "warning" && value > 0 ? "text-warning" : "text-foreground"}`}>{value}</p>
      {hint && <p className="text-[11px] text-foreground-subtle">{hint}</p>}
    </div>
  );
}

export default async function AcessosPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.USER_MANAGE);
  const overview = await getAccessOverview(user);

  const maxDay = Math.max(1, ...overview.days.map((d) => d.users));
  const pct = (n: number) => (overview.activeUsers > 0 ? Math.round((n / overview.activeUsers) * 100) : 0);

  return (
    <>
      <PageHeader
        title="Acessos"
        description="Quem está usando o SIGO: acessos por dia e por mês, e quem ainda não entrou ou parou de entrar."
      />
      <PageBody>
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Usuários ativos" value={overview.activeUsers} />
              <Stat label="Acessaram hoje" value={overview.today} hint={`${pct(overview.today)}% da base`} />
              <Stat label="Últimos 7 dias" value={overview.last7Days} hint={`${pct(overview.last7Days)}% da base`} />
              <Stat label="Últimos 30 dias" value={overview.last30Days} hint={`${pct(overview.last30Days)}% da base`} />
              <Stat label="Nunca acessaram" value={overview.neverAccessed.length} tone="warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pessoas diferentes por dia — últimos 30 dias</CardTitle>
            <CardDescription>
              Conta quem fez login ou usou o sistema no dia. O registro de uso diário começou a valer em outubro de 2026;
              antes disso só existe o histórico de logins, que subconta quem permanece logado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-36 items-end gap-1">
              {overview.days.map((d) => (
                <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date.split("-").reverse().join("/")}: ${d.users} pessoa(s), ${d.logins} login(s)`}>
                  <div
                    className={d.users > 0 ? "rounded-t bg-accent" : "rounded-t bg-border"}
                    style={{ height: `${d.users > 0 ? Math.max(6, (d.users / maxDay) * 100) : 3}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-foreground-subtle">
              <span>{overview.days[0].date.split("-").reverse().slice(0, 2).join("/")}</span>
              <span>pico: {maxDay > 1 || overview.days.some((d) => d.users > 0) ? `${maxDay} pessoa(s)` : "—"}</span>
              <span>hoje</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
          <Card>
            <CardHeader>
              <CardTitle>Histórico mensal</CardTitle>
              <CardDescription>Cada mês fica guardado.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Pessoas</TableHead>
                    <TableHead>Logins</TableHead>
                    <TableHead>Dias com acesso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.months.length === 0 && <TableEmpty colSpan={4} />}
                  {overview.months.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell>{monthLabel(m.month)}</TableCell>
                      <TableCell className="tabular-nums">{m.users}</TableCell>
                      <TableCell className="tabular-nums text-foreground-subtle">{m.logins}</TableCell>
                      <TableCell className="tabular-nums text-foreground-subtle">{m.activeDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nunca acessaram ({overview.neverAccessed.length})</CardTitle>
              <CardDescription>Usuários ativos que ainda não entraram no sistema.</CardDescription>
            </CardHeader>
            <CardContent className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
              {overview.neverAccessed.length === 0 && <p className="text-sm text-foreground-subtle">Todo mundo já acessou.</p>}
              {overview.neverAccessed.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                  <span className="truncate">{u.name}</span>
                  <span className="shrink-0 text-xs text-foreground-subtle">{u.role}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pararam de entrar ({overview.inactive.length})</CardTitle>
            <CardDescription>Já acessaram, mas o último acesso foi há mais de 14 dias.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Último acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.inactive.length === 0 && <TableEmpty colSpan={3} />}
                {overview.inactive.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell><Link href="/usuarios" className="text-accent hover:underline">{u.name}</Link></TableCell>
                    <TableCell className="text-foreground-subtle">{u.role}</TableCell>
                    <TableCell className="text-foreground-subtle">{formatDateTime(u.lastAccess)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
