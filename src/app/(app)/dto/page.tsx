import Link from "next/link";
import { after } from "next/server";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { requireUser, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { generateMissingActions, getDtoSuggestions, latestDtoMonth, listDtoOfMonth } from "@/server/services/dto.service";
import { currentMonthKey, isValidMonthKey, monthLabel, shiftMonth } from "@/lib/month";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DtoList } from "@/components/domain/dto-list";
import { DtoSuggestions } from "@/components/domain/dto-suggestions";
import { DtoCalendar } from "@/components/domain/dto-calendar";
import { getDtoCalendar } from "@/server/services/dto-calendar.service";
import { cn } from "@/lib/utils";

export default async function DtoPage({ searchParams }: { searchParams: Promise<{ mes?: string; aba?: string; semana?: string; pordia?: string }> }) {
  const user = await requireUser();
  const canImport = hasPermission(user, PERMISSIONS.DTO_MANAGE);
  if (!canImport && !hasPermission(user, PERMISSIONS.DTO_VIEW)) throw new ForbiddenError();

  const { mes, aba, semana, pordia } = await searchParams;
  // As ações dos DTOs recentes se completam sozinhas (em segundo plano) sempre que alguém abre esta tela.
  after(() => generateMissingActions());
  const tab = aba === "sugestoes" ? "sugestoes" : aba === "calendario" ? "calendario" : "realizados";
  const nowMonth = currentMonthKey();
  // Sem mês escolhido, abre no mês do DTO mais recente (os DTOs são feitos aos poucos, o mês corrente pode estar vazio).
  const month = isValidMonthKey(mes) && mes <= nowMonth ? mes : ((await latestDtoMonth(user)) ?? nowMonth);

  const [items, suggestions] = await Promise.all([listDtoOfMonth(user, month), getDtoSuggestions(user)]);
  const suggestedCount = suggestions.items.filter((i) => i.eligible).length;
  const calendar = tab === "calendario" ? await getDtoCalendar(user, { weekKey: semana, perDay: Number(pordia) || undefined }) : null;
  const scored = items.filter((i) => i.scorePercent !== null);
  const average = scored.length > 0 ? Math.round(scored.reduce((sum, i) => sum + (i.scorePercent ?? 0), 0) / scored.length) : null;
  const totalNo = items.reduce((sum, i) => sum + i.noCount, 0);

  return (
    <>
      <PageHeader
        title="DTO"
        description="Observações de atividade (DTO) feitas pela liderança e importadas do DMPeople. Cada colaborador vê os dele no Meu Perfil."
        actions={
          canImport ? (
            <Button asChild size="sm">
              <Link href="/dto/importar">
                <Upload className="size-4" /> Importar planilha
              </Link>
            </Button>
          ) : undefined
        }
      />
      <PageBody>
        <div className="flex gap-1 border-b border-border">
          {[
            { key: "realizados", label: "DTOs realizados", href: "/dto" },
            { key: "sugestoes", label: `Sugestões de DTO (${suggestedCount})`, href: "/dto?aba=sugestoes" },
            { key: "calendario", label: "Calendário semanal", href: "/dto?aba=calendario" },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                tab === t.key ? "border-accent text-foreground" : "border-transparent text-foreground-subtle hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {tab === "calendario" && calendar ? (
          <DtoCalendar calendar={calendar} />
        ) : tab === "sugestoes" ? (
          <DtoSuggestions
            items={suggestions.items}
            cooldownDays={suggestions.cooldownDays}
            canJustify={suggestions.canJustify}
            todayKey={suggestions.todayKey}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="secondary" asChild>
                <Link href={`/dto?mes=${shiftMonth(month, -1)}`} aria-label="Mês anterior"><ChevronLeft className="size-4" /></Link>
              </Button>
              <span className="min-w-40 text-center text-sm font-medium text-foreground">{monthLabel(month)}</span>
              {month < nowMonth ? (
                <Button size="icon" variant="secondary" asChild>
                  <Link href={`/dto?mes=${shiftMonth(month, 1)}`} aria-label="Próximo mês"><ChevronRight className="size-4" /></Link>
                </Button>
              ) : (
                <Button size="icon" variant="secondary" disabled aria-label="Próximo mês"><ChevronRight className="size-4" /></Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard label="DTOs no mês" value={items.length} />
              <StatCard
                label="Conformidade média"
                value={average === null ? "—" : `${average}%`}
                tone={average === null ? "neutral" : average >= 90 ? "success" : average >= 70 ? "warning" : "danger"}
              />
              <StatCard label="Itens com “Não”" value={totalNo} tone={totalNo > 0 ? "warning" : "success"} />
            </div>

            {items.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-foreground-subtle">Nenhum DTO neste mês.</CardContent>
              </Card>
            ) : (
              <DtoList items={items} showCollaborator withFilters />
            )}
          </>
        )}
      </PageBody>
    </>
  );
}
