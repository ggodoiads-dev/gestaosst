import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { getTemplateDetail } from "@/server/services/checklist-template.service";
import { listEquipmentsByType } from "@/server/services/equipment.service";
import { listFaultCategories } from "@/server/services/masterdata.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { TemplateStatusBadge } from "@/components/domain/status-badges";
import { VersionTabs } from "./version-tabs";
import { NewDraftVersionButton, AssignEquipmentDialog, SyncAreaEquipmentButton } from "./template-header-actions";

export default async function ModeloChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);

  const [template, faultCategories] = await Promise.all([
    getTemplateDetail(id),
    listFaultCategories(),
  ]);
  const equipments = await listEquipmentsByType(template.equipmentTypeId);

  const hasDraft = template.versions.some((v) => v.status === "RASCUNHO");
  const assignedIds = template.assignments.map((a) => a.equipmentId);

  return (
    <>
      <PageHeader
        title={template.name}
        description={
          template.scope === "AREA"
            ? `Checklist de área: ${template.area?.name ?? "—"}`
            : template.description ?? `Tipo de equipamento: ${template.equipmentType.name}`
        }
        actions={
          <div className="flex items-center gap-2">
            <TemplateStatusBadge status={template.status} />
            {template.scope === "AREA" ? (
              <SyncAreaEquipmentButton templateId={template.id} />
            ) : (
              <AssignEquipmentDialog templateId={template.id} equipments={equipments} assignedIds={assignedIds} />
            )}
            {!hasDraft && <NewDraftVersionButton templateId={template.id} />}
          </div>
        }
      />
      <PageBody>
        <VersionTabs templateId={template.id} versions={template.versions} faultCategories={faultCategories} />
      </PageBody>
    </>
  );
}
