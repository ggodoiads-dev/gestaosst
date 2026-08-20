import { requireUser } from "@/server/auth/current-user";
import { listJobFunctions, listEpiTypes, getJobFunctionKit, getJobFunctionRequiredChecklists } from "@/server/services/epi.service";
import { listTemplates } from "@/server/services/checklist-template.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SoftDeleteButton, ReactivateButton } from "@/components/domain/soft-delete-button";
import { setJobFunctionActiveAction } from "@/server/actions/epi.actions";
import { CreateJobFunctionDialog } from "./job-function-form-dialog";
import { EditJobFunctionKitDialog } from "./job-function-kit-dialog";
import { EditJobFunctionChecklistsDialog } from "./job-function-checklist-dialog";

export default async function FuncoesCadastroPage() {
  const user = await requireUser();
  const [jobFunctions, epiTypes, allTemplates] = await Promise.all([
    listJobFunctions(user),
    listEpiTypes(user, { onlyActive: true }),
    listTemplates(),
  ]);
  const kits = await Promise.all(jobFunctions.map((jf) => getJobFunctionKit(user, jf.id)));
  const requiredChecklists = await Promise.all(jobFunctions.map((jf) => getJobFunctionRequiredChecklists(jf.id)));
  const publishedTemplates = allTemplates.filter((t) => t.status === "PUBLICADO").map((t) => ({ id: t.id, name: t.name }));

  return (
    <>
      <PageHeader
        title="Funções"
        description="Cadastro de funções e do kit de EPI padrão de cada uma. Ao cadastrar um colaborador com a função, o kit é lançado automaticamente na ficha de EPI dele."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Funções ({jobFunctions.length})</CardTitle>
            <CreateJobFunctionDialog />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Kit de EPI</TableHead>
                  <TableHead>Checklists obrigatórios</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-56" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobFunctions.length === 0 && <TableEmpty colSpan={5} />}
                {jobFunctions.map((jobFunction, index) => {
                  const kit = kits[index];
                  const required = requiredChecklists[index]!;
                  return (
                    <TableRow key={jobFunction.id} className={!jobFunction.active ? "opacity-60" : undefined}>
                      <TableCell>{jobFunction.name}</TableCell>
                      <TableCell className="text-foreground-subtle">
                        {kit.length === 0 ? "Nenhum item" : kit.map((item) => item.epiType.name).join(", ")}
                      </TableCell>
                      <TableCell className="text-foreground-subtle">
                        {required.length === 0 ? "Nenhum" : required.map((r) => r.template.name).join(", ")}
                      </TableCell>
                      <TableCell>
                        <Badge tone={jobFunction.active ? "success" : "neutral"}>
                          {jobFunction.active ? "Ativo" : "Excluído"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <EditJobFunctionKitDialog
                            jobFunction={jobFunction}
                            epiTypes={epiTypes}
                            currentKit={kit.map((item) => ({ epiTypeId: item.epiTypeId, quantity: item.quantity }))}
                          />
                          <EditJobFunctionChecklistsDialog
                            jobFunction={jobFunction}
                            templates={publishedTemplates}
                            currentTemplateIds={required.map((r) => r.templateId)}
                          />
                          {jobFunction.active ? (
                            <SoftDeleteButton
                              title={`Excluir ${jobFunction.name}?`}
                              description="Deixa de aparecer no cadastro de colaboradores. Colaboradores já vinculados a essa função continuam com ela, e você pode reativá-la depois."
                              ariaLabel="Excluir função"
                              successMessage={`${jobFunction.name} excluída.`}
                              onConfirm={setJobFunctionActiveAction.bind(null, jobFunction.id, false)}
                            />
                          ) : (
                            <ReactivateButton
                              ariaLabel="Reativar função"
                              successMessage={`${jobFunction.name} reativada.`}
                              onConfirm={setJobFunctionActiveAction.bind(null, jobFunction.id, true)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
