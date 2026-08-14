import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listTemplates } from "@/server/services/checklist-template.service";
import { listEquipmentTypes } from "@/server/services/masterdata.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/domain/clickable-row";
import { TemplateStatusBadge } from "@/components/domain/status-badges";
import { CreateTemplateDialog } from "./create-template-dialog";

export default async function ModelosChecklistPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.CHECKLIST_TEMPLATE_MANAGE);

  const [templates, types] = await Promise.all([listTemplates(), listEquipmentTypes()]);

  return (
    <>
      <PageHeader
        title="Modelos de Checklist"
        description="Modelos versionados de checklist, associados a tipos de equipamento."
        actions={<CreateTemplateDialog types={types} />}
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo de equipamento</TableHead>
                  <TableHead>Versão atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Equipamentos vinculados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 && <TableEmpty colSpan={5} />}
                {templates.map((template) => (
                  <ClickableRow key={template.id} href={`/cadastros/modelos-checklist/${template.id}`}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.equipmentType.name}</TableCell>
                    <TableCell>
                      {template.versions[0] ? `V${template.versions[0].versionNumber}` : "—"}
                    </TableCell>
                    <TableCell><TemplateStatusBadge status={template.status} /></TableCell>
                    <TableCell>{template._count.assignments}</TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
