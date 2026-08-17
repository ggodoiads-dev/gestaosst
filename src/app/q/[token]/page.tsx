import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getEquipmentPhoto } from "@/server/services/equipment.service";
import { getCollaboratorPhoto } from "@/server/services/collaborator.service";
import { attachmentUrl } from "@/lib/attachment-url";
import { qualificationStatus } from "@/lib/qualification-status";
import { EquipmentStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import type { Equipment, EquipmentType, Area, Collaborator } from "@/generated/prisma/client";

/**
 * QR Code do equipamento e do colaborador levam direto pro prontuário completo quando o
 * usuário está autenticado; sem sessão, mostram uma ficha pública com informações limitadas
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

  const collaborator = await db.collaborator.findUnique({ where: { qrToken: token }, include: { area: true } });
  if (collaborator) {
    if (user) redirect(`/colaboradores/${collaborator.id}`);
    const [photo, qualifications, aptitudes] = await Promise.all([
      getCollaboratorPhoto(collaborator.id),
      db.qualificationRecord.findMany({
        where: { collaboratorId: collaborator.id },
        include: { qualificationType: true },
        orderBy: { completedDate: "desc" },
      }),
      db.collaboratorActivity.findMany({ where: { collaboratorId: collaborator.id }, include: { activity: true } }),
    ]);
    const seenTypeIds = new Set<string>();
    const currentQualifications = qualifications.filter((q) => {
      if (seenTypeIds.has(q.qualificationTypeId)) return false;
      seenTypeIds.add(q.qualificationTypeId);
      return true;
    });
    return (
      <PublicPageShell>
        <PublicCollaboratorView
          collaborator={collaborator}
          photoUrl={photo ? attachmentUrl(photo.path) : null}
          qualifications={currentQualifications}
          aptitudes={aptitudes}
        />
      </PublicPageShell>
    );
  }

  notFound();
}

function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-brand px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <div className="rounded-md bg-white px-4 py-2.5">
            <Image src="/sigo-logo.png" alt="SIGO" width={140} height={46} priority />
          </div>
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

function PublicCollaboratorView({
  collaborator,
  photoUrl,
  qualifications,
  aptitudes,
}: {
  collaborator: Collaborator & { area: Area | null };
  photoUrl: string | null;
  qualifications: { id: string; expiresAt: Date | null; qualificationType: { name: string } }[];
  aptitudes: { id: string; activity: { name: string } }[];
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- servido pela rota autenticada /api/uploads
        <img src={photoUrl} alt={collaborator.name} className="size-24 rounded-full border border-border object-cover" />
      ) : (
        <div className="size-24 rounded-full border border-dashed border-border-strong bg-surface-muted" />
      )}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{collaborator.name}</h1>
        <p className="text-sm text-foreground-subtle">
          {collaborator.cargo ?? "Cargo não informado"}
          {collaborator.area ? ` · ${collaborator.area.name}` : ""}
        </p>
      </div>
      {collaborator.active ? <Badge tone="success">Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}

      {qualifications.length > 0 && (
        <div className="w-full border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">Qualificações</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {qualifications.map((q) => {
              const status = qualificationStatus(q.expiresAt);
              return (
                <Badge key={q.id} tone={status.tone}>
                  {q.qualificationType.name}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {aptitudes.length > 0 && (
        <div className="w-full border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">Apto a</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {aptitudes.map((a) => (
              <Badge key={a.id} tone="info">{a.activity.name}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
