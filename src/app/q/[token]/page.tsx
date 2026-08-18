import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getEquipmentPhoto } from "@/server/services/equipment.service";
import { getCollaboratorPhoto } from "@/server/services/collaborator.service";
import { attachmentUrl } from "@/lib/attachment-url";
import { qualificationStatus } from "@/lib/qualification-status";
import { formatDate } from "@/lib/dates";
import { EquipmentStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import type { Equipment, EquipmentType, Area, Collaborator } from "@/generated/prisma/client";

/**
 * QR Code do equipamento, do colaborador e da área levam direto pro prontuário completo quando
 * o usuário está autenticado; sem sessão, mostram uma ficha pública com informações limitadas
 * (sem dado sensível) em vez de pedir login — é assim que um QR físico deve funcionar: qualquer
 * pessoa que o escaneie (visitante, prestador, fiscal) consegue ler na hora. O QR individual de
 * item de EPI continua exigindo login, por ser um controle interno de RH sem valor pra visitante.
 */
export default async function QrResolverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const user = await getCurrentUser();
  const { token } = await params;

  const equipment = await db.equipment.findUnique({ where: { qrToken: token }, include: { type: true, area: true } });
  if (equipment) {
    if (user) redirect(`/equipamentos/${equipment.id}`);
    const photo = await getEquipmentPhoto(equipment.id);
    return (
      <PublicPageShell>
        <PublicEquipmentView equipment={equipment} photoUrl={photo ? attachmentUrl(photo.path) : null} />
      </PublicPageShell>
    );
  }

  const epiDelivery = await db.epiDelivery.findUnique({ where: { qrToken: token } });
  if (epiDelivery) {
    if (!user) redirect("/login");
    redirect(`/colaboradores/${epiDelivery.collaboratorId}#epi-${epiDelivery.id}`);
  }

  const collaborator = await db.collaborator.findUnique({ where: { qrToken: token } });
  if (collaborator) {
    if (user) redirect(`/colaboradores/${collaborator.id}`);
    const [summary, photo, equipmentAptitudes, lastExecution] = await Promise.all([
      getQualificationSummary(collaborator.id),
      getCollaboratorPhoto(collaborator.id),
      db.collaboratorEquipment.findMany({
        where: { collaboratorId: collaborator.id },
        include: { equipment: true },
        orderBy: { equipment: { name: "asc" } },
      }),
      collaborator.userId
        ? db.checklistExecution.findFirst({
            where: { executedById: collaborator.userId },
            orderBy: { startedAt: "desc" },
            include: { equipment: true },
          })
        : null,
    ]);
    return (
      <PublicPageShell>
        <PublicCollaboratorView
          collaborator={collaborator}
          photoUrl={photo ? attachmentUrl(photo.path) : null}
          summary={summary}
          equipmentAptitudes={equipmentAptitudes.map((a) => a.equipment)}
          lastExecution={lastExecution}
        />
      </PublicPageShell>
    );
  }

  const area = await db.area.findUnique({ where: { qrToken: token } });
  if (area) {
    const collaborators = await db.collaborator.findMany({
      where: { areaId: area.id, active: true },
      orderBy: { name: "asc" },
    });
    const summaries = await Promise.all(
      collaborators.map(async (c) => {
        const [summary, photo] = await Promise.all([getQualificationSummary(c.id), getCollaboratorPhoto(c.id)]);
        return { collaborator: c, summary, photoUrl: photo ? attachmentUrl(photo.path) : null };
      }),
    );
    return (
      <PublicPageShell wide>
        <PublicAreaView area={area} entries={summaries} />
      </PublicPageShell>
    );
  }

  notFound();
}

type QualificationSummary = {
  aso: { typeName: string; expiresAt: Date | null } | null;
  nrs: { typeName: string; expiresAt: Date | null }[];
  hasAnyRecord: boolean;
  hasAnyExpired: boolean;
  apt: boolean;
};

/** ASO/NR mais recente de cada tipo pro colaborador, e se ele está "apto" (sem nenhum vencido e com pelo menos 1 registro). */
async function getQualificationSummary(collaboratorId: string): Promise<QualificationSummary> {
  const records = await db.qualificationRecord.findMany({
    where: { collaboratorId },
    include: { qualificationType: true },
    orderBy: { completedDate: "desc" },
  });

  const seenTypeIds = new Set<string>();
  const current = records.filter((r) => {
    if (seenTypeIds.has(r.qualificationTypeId)) return false;
    seenTypeIds.add(r.qualificationTypeId);
    return true;
  });

  const now = new Date();
  const hasAnyExpired = current.some((r) => r.expiresAt && r.expiresAt < now);
  const aso = current.find((r) => r.qualificationType.category === "ASO");
  const nrs = current.filter((r) => r.qualificationType.category === "NR");

  return {
    aso: aso ? { typeName: aso.qualificationType.name, expiresAt: aso.expiresAt } : null,
    nrs: nrs.map((r) => ({ typeName: r.qualificationType.name, expiresAt: r.expiresAt })),
    hasAnyRecord: current.length > 0,
    hasAnyExpired,
    apt: current.length > 0 && !hasAnyExpired,
  };
}

function PublicPageShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-brand px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className={wide ? "relative w-full max-w-2xl" : "relative w-full max-w-sm"}>
        <div className="mb-6 flex justify-center">
          <Image src="/sigo-logo.png" alt="SIGO" width={140} height={46} priority />
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-xl">{children}</div>
        <p className="mt-6 text-center text-xs text-white/45">Consulta pública — informações limitadas.</p>
      </div>
    </div>
  );
}

function PublicEquipmentView({
  equipment,
  photoUrl,
}: {
  equipment: Equipment & { type: EquipmentType; area: Area };
  photoUrl: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- servido pela rota autenticada /api/uploads
        <img src={photoUrl} alt={equipment.name} className="size-24 rounded-lg border border-border object-cover" />
      ) : (
        <div className="size-24 rounded-lg border border-dashed border-border-strong bg-surface-muted" />
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">{equipment.code}</p>
        <h1 className="text-lg font-semibold text-foreground">{equipment.name}</h1>
        <p className="text-sm text-foreground-subtle">
          {equipment.type.name} · {equipment.area.name}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <EquipmentStatusBadge status={equipment.status} />
        <CriticalityBadge value={equipment.criticality} />
      </div>
    </div>
  );
}

function QualificationList({ summary }: { summary: QualificationSummary }) {
  return (
    <div className="w-full space-y-3 border-t border-border pt-3 text-left">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">ASO</p>
        {summary.aso ? (
          <div className="mt-1 flex items-center justify-between text-sm">
            <span>{summary.aso.typeName}</span>
            <Badge tone={qualificationStatus(summary.aso.expiresAt).tone}>
              {qualificationStatus(summary.aso.expiresAt).label}
            </Badge>
          </div>
        ) : (
          <p className="mt-1 text-sm text-foreground-subtle">Nenhum ASO registrado.</p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">NRs</p>
        {summary.nrs.length === 0 && <p className="mt-1 text-sm text-foreground-subtle">Nenhuma NR registrada.</p>}
        <div className="mt-1 flex flex-col gap-1.5">
          {summary.nrs.map((nr) => (
            <div key={nr.typeName} className="flex items-center justify-between text-sm">
              <span>{nr.typeName}</span>
              <Badge tone={qualificationStatus(nr.expiresAt).tone}>{qualificationStatus(nr.expiresAt).label}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PublicCollaboratorView({
  collaborator,
  photoUrl,
  summary,
  equipmentAptitudes,
  lastExecution,
}: {
  collaborator: Collaborator;
  photoUrl: string | null;
  summary: QualificationSummary;
  equipmentAptitudes: Equipment[];
  lastExecution: { startedAt: Date; equipment: Equipment } | null;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- servido pela rota autenticada /api/uploads
        <img src={photoUrl} alt={collaborator.name} className="size-24 rounded-full border border-border object-cover" />
      ) : (
        <div className="size-24 rounded-full border border-dashed border-border-strong bg-surface-muted" />
      )}
      <h1 className="text-lg font-semibold text-foreground">{collaborator.name}</h1>

      <div className="grid w-full grid-cols-2 gap-3 text-left text-sm">
        <div>
          <p className="text-xs text-foreground-subtle">Matrícula</p>
          <p>{collaborator.matricula ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-foreground-subtle">CPF</p>
          <p>{collaborator.cpf ?? "—"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-foreground-subtle">Data de admissão</p>
          <p>{formatDate(collaborator.admissionDate)}</p>
        </div>
      </div>

      <QualificationList summary={summary} />

      <div className="w-full border-t border-border pt-3 text-left">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
          Equipamentos que pode operar
        </p>
        {equipmentAptitudes.length === 0 ? (
          <p className="text-sm text-foreground-subtle">Nenhum equipamento cadastrado.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {equipmentAptitudes.map((eq) => (
              <Badge key={eq.id} tone="info">{eq.code} — {eq.name}</Badge>
            ))}
          </div>
        )}
      </div>

      {lastExecution && (
        <div className="w-full border-t border-border pt-3 text-left">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Último checklist realizado
          </p>
          <p className="text-sm">
            {formatDate(lastExecution.startedAt)} — {lastExecution.equipment.code} ({lastExecution.equipment.name})
          </p>
        </div>
      )}
    </div>
  );
}

function PublicAreaView({
  area,
  entries,
}: {
  area: Area;
  entries: { collaborator: Collaborator; summary: QualificationSummary; photoUrl: string | null }[];
}) {
  const aptos = entries.filter((e) => e.summary.apt);

  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">{area.code}</p>
        <h1 className="text-lg font-semibold text-foreground">{area.name}</h1>
        <p className="text-sm text-foreground-subtle">
          {entries.length} cadastrado(s) · {aptos.length} apto(s)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <p className="text-center text-sm text-foreground-subtle">Nenhum colaborador cadastrado nessa área.</p>
        )}
        {entries.map(({ collaborator, summary, photoUrl }) => (
          <div key={collaborator.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- servido pela rota autenticada /api/uploads
                  <img
                    src={photoUrl}
                    alt={collaborator.name}
                    className="size-10 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <div className="size-10 shrink-0 rounded-full border border-dashed border-border-strong bg-surface-muted" />
                )}
                <div>
                  <p className="font-medium text-foreground">{collaborator.name}</p>
                  <p className="text-xs text-foreground-subtle">Matrícula: {collaborator.matricula ?? "—"}</p>
                </div>
              </div>
              <Badge tone={summary.apt ? "success" : "neutral"}>{summary.apt ? "Apto" : "Não apto"}</Badge>
            </div>
            <QualificationList summary={summary} />
          </div>
        ))}
      </div>
    </div>
  );
}
