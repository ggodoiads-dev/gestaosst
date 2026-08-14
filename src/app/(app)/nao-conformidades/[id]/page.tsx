import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getNonconformityDetail } from "@/server/services/nonconformity.service";
import { listActiveUsers } from "@/server/services/user.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { NonconformityStatusBadge, CriticalityBadge } from "@/components/domain/status-badges";
import { formatDateTime } from "@/lib/dates";
import { attachmentUrl } from "@/lib/attachment-url";
import { CreateActionItemDialog } from "./create-action-item-dialog";
import { ActionItemRow } from "./action-item-row";

export default async function NonconformidadeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [nc, users] = await Promise.all([getNonconformityDetail(user, id), listActiveUsers()]);

  const canValidate = hasPermission(user, PERMISSIONS.ACTIONITEM_VALIDATE);
  const canManage = hasPermission(user, PERMISSIONS.ACTIONPLAN_MANAGE);

  return (
    <>
      <PageHeader
        title={`${nc.code} — ${nc.equipment.name}`}
        description={`Identificada em ${formatDateTime(nc.identifiedAt)} por ${nc.identifiedBy.name}`}
        actions={
          <div className="flex items-center gap-2">
            <CriticalityBadge value={nc.severity} />
            <NonconformityStatusBadge status={nc.status} />
          </div>
        }
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-foreground-subtle">Equipamento</p>
              <Link href={`/equipamentos/${nc.equipmentId}`} className="text-accent hover:underline">
                {nc.equipment.code} — {nc.equipment.name}
              </Link>
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Área</p>
              <p>{nc.area.name}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Categoria da falha</p>
              <p>{nc.faultCategory?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">Pergunta de origem</p>
              <p>{nc.originAnswer?.question.title ?? "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-foreground-subtle">Descrição</p>
              <p>{nc.description}</p>
            </div>
            {nc.originAnswer?.attachments && nc.originAnswer.attachments.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs text-foreground-subtle mb-1.5">Fotos</p>
                <div className="flex gap-2">
                  {nc.originAnswer.attachments.map((a) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={a.id}
                      src={attachmentUrl(a.path)}
                      alt="Evidência"
                      className="h-24 w-24 rounded-md border border-border object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plano de ação</CardTitle>
            {canManage && !["ENCERRADA", "CANCELADA"].includes(nc.status) && (
              <CreateActionItemDialog nonconformityId={nc.id} users={users} />
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(!nc.actionPlan || nc.actionPlan.items.length === 0) && (
              <p className="text-sm text-foreground-subtle">Nenhuma ação cadastrada ainda.</p>
            )}
            {nc.actionPlan?.items.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                nonconformityId={nc.id}
                equipmentId={nc.equipmentId}
                canValidate={canValidate}
              />
            ))}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
