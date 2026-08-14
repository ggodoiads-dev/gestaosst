import Link from "next/link";
import { ChevronRight, Clock, MapPin } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { listChecklistBoardForUser } from "@/server/services/checklist-execution.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/dates";

const SITUATION_CONFIG = {
  REALIZADO: { label: "Realizado", tone: "success" as const },
  EM_ANDAMENTO: { label: "Em andamento", tone: "info" as const },
  ATRASADO: { label: "Atrasado", tone: "danger" as const },
  PENDENTE: { label: "Pendente", tone: "neutral" as const },
};

export default async function RealizarChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const user = await requireUser();
  const { area: selectedAreaId } = await searchParams;
  const board = await listChecklistBoardForUser(user);

  type BoardItem = (typeof board)[number];
  const areaMap = new Map<string, { id: string; name: string; items: BoardItem[] }>();
  for (const item of board) {
    const area = item.equipment.area;
    if (!areaMap.has(area.id)) areaMap.set(area.id, { id: area.id, name: area.name, items: [] });
    areaMap.get(area.id)!.items.push(item);
  }
  const areas = [...areaMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Seção 13: se o usuário só tem uma área, não obriga a selecionar toda vez.
  const effectiveAreaId = areas.length <= 1 ? areas[0]?.id : selectedAreaId;
  const currentArea = effectiveAreaId ? areaMap.get(effectiveAreaId) : undefined;

  if (board.length === 0) {
    return (
      <>
        <PageHeader
          title="Realizar Checklist"
          description="Selecione um equipamento para iniciar ou continuar a inspeção."
        />
        <PageBody>
          <p className="text-sm text-foreground-subtle">
            Nenhum equipamento com checklist configurado nas suas áreas.
          </p>
        </PageBody>
      </>
    );
  }

  if (!currentArea) {
    return (
      <>
        <PageHeader title="Realizar Checklist" description="Selecione a área onde você vai realizar a inspeção." />
        <PageBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map((area) => {
              const pendentes = area.items.filter(
                (i) => i.situation === "PENDENTE" || i.situation === "ATRASADO",
              ).length;
              const atrasados = area.items.filter((i) => i.situation === "ATRASADO").length;
              return (
                <Link
                  key={area.id}
                  href={`/checklist/realizar?area=${area.id}`}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 hover:border-accent hover:bg-accent-soft/40 transition-colors"
                >
                  <div className="flex items-center gap-2 text-foreground">
                    <MapPin className="size-4 text-accent" />
                    <span className="font-semibold">{area.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground-subtle">
                    <span>{area.items.length} equipamento{area.items.length === 1 ? "" : "s"}</span>
                    {pendentes > 0 && (
                      <Badge tone={atrasados > 0 ? "danger" : "warning"} dot>
                        {pendentes} pendente{pendentes === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
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
        title="Realizar Checklist"
        description={
          areas.length > 1 ? (
            <>
              Área: <strong className="text-foreground">{currentArea.name}</strong>
              {" · "}
              <Link href="/checklist/realizar" className="text-accent hover:underline">
                Trocar área
              </Link>
            </>
          ) : (
            "Selecione um equipamento para iniciar ou continuar a inspeção."
          )
        }
      />
      <PageBody>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {currentArea.items.map((item) => {
            const cfg = SITUATION_CONFIG[item.situation];
            return (
              <Link
                key={item.equipment.id}
                href={`/checklist/realizar/${item.equipment.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-muted transition-colors"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {item.equipment.code} — {item.equipment.name}
                  </span>
                  <span className="text-xs text-foreground-subtle flex items-center gap-1">
                    {item.templateName}
                    {item.scheduledFor && (
                      <>
                        <span className="mx-1">·</span>
                        <Clock className="size-3" /> previsto {formatTime(item.scheduledFor)}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={cfg.tone} dot>{cfg.label}</Badge>
                  <ChevronRight className="size-4 text-foreground-subtle" />
                </div>
              </Link>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
