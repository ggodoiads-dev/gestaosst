import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getEquipmentPhoto } from "@/server/services/equipment.service";
import { getCollaboratorPhoto } from "@/server/services/collaborator.service";
import { getCollaboratorQualificationSummary, type CollaboratorQualificationSummary } from "@/server/services/qualification.service";
import { listAreaDocuments } from "@/server/services/masterdata.service";
import { readFileBuffer } from "@/server/services/storage";
import { qualificationStatus } from "@/lib/qualification-status";
import { formatDate } from "@/lib/dates";
import { EquipmentStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import { PublicPhoto } from "./public-photo";
import type { Equipment, EquipmentType, Area, Collaborator } from "@/generated/prisma/client";

/** `/api/uploads` exige login (fotos nunca têm URL pública direta), mas as fichas de `/q/[token]`
 * são acessadas sem sessão — por isso a foto é lida no servidor e embutida como data URI direto
 * no HTML, em vez de referenciar a rota autenticada (que daria 401 pra um visitante anônimo). */
async function photoDataUrl(photo: { path: string; mimeType: string } | null): Promise<string | null> {
  if (!photo) return null;
  try {
    const buffer = await readFileBuffer(photo.path);
    return `data:${photo.mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

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
        <PublicEquipmentView equipment={equipment} photoUrl={await photoDataUrl(photo)} />
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
    // Colaborador desligado: pra um visitante anônimo escaneando o crachá físico, a ficha some —
    // mesmo comportamento de "não encontrado", pra não deixar foto/CPF/dados expostos indefinidamente
    // só porque o qrToken nunca é trocado no desligamento. Usuário logado continua vendo via redirect acima.
    if (!collaborator.active) notFound();
    const [summary, photo, equipmentAptitudes, lastExecution] = await Promise.all([
      getCollaboratorQualificationSummary(collaborator.id),
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
          photoUrl={await photoDataUrl(photo)}
          summary={summary}
          equipmentAptitudes={equipmentAptitudes.map((a) => a.equipment)}
          lastExecution={lastExecution}
        />
      </PublicPageShell>
    );
  }

  const area = await db.area.findUnique({ where: { qrToken: token } });
  if (area) {
    const [collaborators, documents] = await Promise.all([
      db.collaborator.findMany({ where: { areaId: area.id, active: true }, orderBy: { name: "asc" } }),
      listAreaDocuments(area.id),
    ]);
    const summaries = await Promise.all(
      collaborators.map(async (c) => {
        const [summary, photo] = await Promise.all([getCollaboratorQualificationSummary(c.id), getCollaboratorPhoto(c.id)]);
        return { collaborator: c, summary, photoUrl: await photoDataUrl(photo) };
      }),
    );
    return (
      <PublicPageShell wide>
        <PublicAreaView
          area={area}
          entries={summaries}
          pop={documents.pop[0] ?? null}
          arVr={documents.arVr[0] ?? null}
        />
      </PublicPageShell>
    );
  }

  notFound();
}

type QualificationSummary = CollaboratorQualificationSummary;

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
        <PublicPhoto src={photoUrl} alt={equipment.name} className="size-24" rounded="lg" />
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

function PublicAttachmentLink({ attachmentId, label = "Ver certificado" }: { attachmentId: string; label?: string }) {
  return (
    <a
      href={`/api/anexo-qr/${attachmentId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-accent hover:underline shrink-0"
    >
      {label}
    </a>
  );
}

function QualificationList({ summary }: { summary: QualificationSummary }) {
  return (
    <div className="w-full space-y-3 border-t border-border pt-3 text-left">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">ASO</p>
        {summary.aso ? (
          <div className="mt-1 flex items-center justify-between gap-2 text-sm">
            <span>{summary.aso.typeName}</span>
            <div className="flex items-center gap-2">
              {summary.aso.certificate && <PublicAttachmentLink attachmentId={summary.aso.certificate.attachmentId} />}
              <Badge tone={qualificationStatus(summary.aso.expiresAt).tone}>
                {qualificationStatus(summary.aso.expiresAt).label}
              </Badge>
            </div>
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
            <div key={nr.typeName} className="flex items-center justify-between gap-2 text-sm">
              <span>{nr.typeName}</span>
              <div className="flex items-center gap-2">
                {nr.certificate && <PublicAttachmentLink attachmentId={nr.certificate.attachmentId} />}
                <Badge tone={qualificationStatus(nr.expiresAt).tone}>{qualificationStatus(nr.expiresAt).label}</Badge>
              </div>
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
        <PublicPhoto src={photoUrl} alt={collaborator.name} className="size-28" rounded="full" />
      ) : (
        <div className="size-28 rounded-full border border-dashed border-border-strong bg-surface-muted" />
      )}
      <h1 className="text-lg font-semibold text-foreground">{collaborator.name}</h1>
      <Badge tone={summary.apt ? "success" : "danger"}>{summary.apt ? "Apto" : "Não apto"}</Badge>

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
  pop,
  arVr,
}: {
  area: Area;
  entries: { collaborator: Collaborator; summary: QualificationSummary; photoUrl: string | null }[];
  pop: { id: string } | null;
  arVr: { id: string } | null;
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
        {(pop || arVr) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            {pop && <PublicAttachmentLink attachmentId={pop.id} label="Ver Procedimento (POP)" />}
            {arVr && <PublicAttachmentLink attachmentId={arVr.id} label="Ver Avaliação de Risco" />}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <p className="text-center text-sm text-foreground-subtle">Nenhum colaborador cadastrado nessa área.</p>
        )}
        {entries.map(({ collaborator, summary, photoUrl }) => (
          <div key={collaborator.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {photoUrl ? (
                  <PublicPhoto src={photoUrl} alt={collaborator.name} className="size-16" rounded="full" />
                ) : (
                  <div className="size-16 shrink-0 rounded-full border border-dashed border-border-strong bg-surface-muted" />
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
