import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getTodayRollCall } from "@/server/services/attendance-rollcall.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RollCallForm } from "./rollcall-form";

const NO_TURNO = "sem";

export default async function ChamadaPage({ searchParams }: { searchParams: Promise<{ turno?: string }> }) {
  const user = await requireUser();
  const entries = await getTodayRollCall(user);
  const { turno } = await searchParams;

  // A chamada é por turno: quem pode fazer a de mais de um turno escolhe primeiro (como no checklist, que pede a área).
  const groups = new Map<string, { id: string; name: string; entries: typeof entries }>();
  for (const e of entries) {
    const id = e.turno.id ?? NO_TURNO;
    const group = groups.get(id) ?? { id, name: e.turno.name ? `Turno ${e.turno.name.replace(/^turno\s+/i, "")}` : "Sem turno definido", entries: [] };
    group.entries.push(e);
    groups.set(id, group);
  }
  const turnos = [...groups.values()].sort((a, b) => (a.id === NO_TURNO ? 1 : b.id === NO_TURNO ? -1 : a.name.localeCompare(b.name, "pt-BR", { numeric: true })));
  const chosen = turno ? groups.get(turno) : turnos.length === 1 ? turnos[0] : undefined;

  if (entries.length === 0) {
    return (
      <>
        <PageHeader title="Fazer Chamada" description="Confirme quem está presente hoje — quem faltar já entra direto na escala." />
        <PageBody>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-foreground-subtle">Ninguém da sua chamada está escalado pra trabalhar hoje.</p>
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  if (!chosen) {
    return (
      <>
        <PageHeader title="Fazer Chamada" description="Escolha o turno da chamada. Aparecem só os turnos que você está liberado para fazer." />
        <PageBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {turnos.map((t) => {
              const onVacation = t.entries.filter((e) => e.vacation).length;
              const people = t.entries.length - onVacation;
              return (
                <Link key={t.id} href={`/chamada?turno=${t.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-5 transition-colors hover:border-accent hover:bg-accent-soft/40">
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-2 font-semibold text-foreground">
                      <Clock className="size-4 text-accent" />
                      {t.name}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-foreground-subtle">
                      {people} pessoa{people === 1 ? "" : "s"} na chamada
                      {onVacation > 0 && <Badge tone="info">{onVacation} de férias</Badge>}
                    </span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-foreground-subtle" />
                </Link>
              );
            })}
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Fazer Chamada"
        description={
          turnos.length > 1 ? (
            <>
              <strong className="text-foreground">{chosen.name}</strong>
              {" · "}
              <Link href="/chamada" className="text-accent hover:underline">
                Trocar turno
              </Link>
            </>
          ) : (
            "Confirme quem está presente hoje — quem faltar já entra direto na escala."
          )
        }
      />
      <PageBody>
        <Card>
          <CardContent className="pt-5">
            <RollCallForm key={chosen.id} entries={chosen.entries} />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
