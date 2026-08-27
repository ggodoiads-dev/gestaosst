import Link from "next/link";
import { ChevronRight, Clock, MapPin, ClipboardList } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import {
  listChecklistBoardForUser,
  type ChecklistBoardEquipmentItem,
  type ChecklistBoardAreaItem,
} from "@/server/services/checklist-execution.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/dates";

const SITUATION_CONFIG = {
  REALIZADO: { label: "Realizado", tone: "success" as const },
  EM_ANDAMENTO: { label: "Em andamento", tone: "info" as const },
  ATRASADO: { label: "Atrasado", tone: "danger" as const },
  PENDENTE: { label: "Pendente", tone: "neutral" as const },
  BLOQUEADO: { label: "Bloqueado", tone: "danger" as const },
};

function isEquipmentItem(item: { type: string }): item is ChecklistBoardEquipmentItem {
  return item.type === "equipamento";
}

function isAreaItem(item: { type: string }): item is ChecklistBoardAreaItem {
  return item.type === "area";
}

type AreaGroup = {
  id: string;
  name: string;
  items: ChecklistBoardEquipmentItem[];
  areaChecklist: ChecklistBoardAreaItem | null;
};

export default async function RealizarChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const user = await requireUser();
  const { area: selectedAreaId } = await searchParams;
  const board = await listChecklistBoardForUser(user);

  const equipmentItems = board.filter(isEquipmentItem);
  const areaChecklistItems = board.filter(isAreaItem);

  const areaMap = new Map<string, AreaGroup>();
  for (const item of equipmentItems) {
    const area = item.equipment.area;
    if (!areaMap.has(area.id)) areaMap.set(area.id, { id: area.id, name: area.name, items: [], areaChecklist: null });
    areaMap.get(area.id)!.items.push(item);
  }
  for (const areaItem of areaChecklistItems) {
    if (!areaMap.has(areaItem.areaId)) {
      areaMap.set(areaItem.areaId, { id: areaItem.areaId, name: areaItem.areaName, items: [], areaChecklist: null });
    }
    areaMap.get(areaItem.areaId)!.areaChecklist = areaItem;
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
              const pendentesEquip = area.items.filter(
                (i) => i.situation === "PENDENTE" || i.situation === "ATRASADO",
              ).length;
              const atrasados = area.items.filter((i) => i.situation === "ATRASADO").length;
              const pendenteArea = area.areaChecklist
                ? area.areaChecklist.totalCount - area.areaChecklist.completedTodayCount
                : 0;
              const pendentes = pendentesEquip + pendenteArea;
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
                    <span>
                      {area.items.length > 0 && `${area.items.length} equipamento${area.items.length === 1 ? "" : "s"}`}
                      {area.items.length > 0 && area.areaChecklist && " · "}
                      {area.areaChecklist && "checklist de área"}
                    </span>
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
          {currentArea.areaChecklist && (
            <Link
              href={`/checklist/realizar/area/${currentArea.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-muted transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <ClipboardList className="size-4 text-accent" />
                  {currentArea.areaChecklist.templateName}
                </span>
                <span className="text-xs text-foreground-subtle">
                  {currentArea.areaChecklist.completedTodayCount} de {currentArea.areaChecklist.totalCount} equipamentos
                  concluídos hoje
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  tone={
                    currentArea.areaChecklist.completedTodayCount >= currentArea.areaChecklist.totalCount
                      ? "success"
                      : "neutral"
                  }
                  dot
                >
                  {currentArea.areaChecklist.completedTodayCount >= currentArea.areaChecklist.totalCount
                    ? "Realizado"
                    : "Pendente"}
                </Badge>
                <ChevronRight className="size-4 text-foreground-subtle" />
              </div>
            </Link>
          )}
          {currentArea.items.map((item) => {
            const cfg = SITUATION_CONFIG[item.situation];
            const blocked = item.situation === "BLOQUEADO";
            const content = (
              <>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {item.equipment.code} — {item.equipment.name}
                  </span>
                  <span className="text-xs text-foreground-subtle flex items-center gap-1">
                    {blocked ? (
                      "Aguardando liberação — não é possível iniciar uma nova inspeção"
                    ) : (
                      <>
                        {item.templateName}
                        {item.scheduledFor && (
                          <>
                            <span className="mx-1">·</span>
                            <Clock className="size-3" /> previsto {formatTime(item.scheduledFor)}
                          </>
                        )}
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={cfg.tone} dot>{cfg.label}</Badge>
                  {!blocked && <ChevronRight className="size-4 text-foreground-subtle" />}
                </div>
              </>
            );

            // Bloqueado não é clicável — iniciar uma nova execução é recusado no servidor de
            // qualquer forma (`getExecutionContext`), mas nem vale deixar a pessoa tentar.
            if (blocked) {
              return (
                <div
                  key={item.equipment.id}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 opacity-80"
                >
                  {content}
                </div>
              );
            }

            return (
              <Link
                key={item.equipment.id}
                href={`/checklist/realizar/${item.equipment.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-muted transition-colors"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
