import { requireUser } from "@/server/auth/current-user";
import { listQualificationTypes } from "@/server/services/qualification.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SoftDeleteButton, ReactivateButton } from "@/components/domain/soft-delete-button";
import { setQualificationTypeActiveAction } from "@/server/actions/qualification.actions";
import { CreateQualificationTypeDialog, EditQualificationTypeDialog } from "./qualification-type-form-dialog";

const CATEGORY_LABELS: Record<string, string> = {
  NR: "NR",
  ASO: "ASO",
  INTEGRACAO: "Integração",
  OUTRO: "Outro",
};

export default async function QualificacoesCadastroPage() {
  const user = await requireUser();
  const types = await listQualificationTypes(user);

  return (
    <>
      <PageHeader
        title="Tipos de Qualificação"
        description="Catálogo de NRs, ASO e integrações usado para registrar qualificações dos colaboradores."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Tipos ({types.length})</CardTitle>
            <CreateQualificationTypeDialog />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.length === 0 && <TableEmpty colSpan={5} />}
                {types.map((type) => (
                  <TableRow key={type.id} className={!type.active ? "opacity-60" : undefined}>
                    <TableCell>{type.name}</TableCell>
                    <TableCell><Badge tone="info">{CATEGORY_LABELS[type.category] ?? type.category}</Badge></TableCell>
                    <TableCell className="text-foreground-subtle">
                      {type.validityMonths ? `${type.validityMonths} meses` : "Não expira"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={type.active ? "success" : "neutral"}>{type.active ? "Ativo" : "Excluído"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditQualificationTypeDialog type={type} />
                        {type.active ? (
                          <SoftDeleteButton
                            title={`Excluir ${type.name}?`}
                            description="Deixa de aparecer nas listas ativas pra registrar novas qualificações. Qualificações já registradas com esse tipo continuam disponíveis, e você pode reativá-lo depois."
                            ariaLabel="Excluir tipo de qualificação"
                            successMessage={`${type.name} excluído.`}
                            onConfirm={setQualificationTypeActiveAction.bind(null, type.id, false)}
                          />
                        ) : (
                          <ReactivateButton
                            ariaLabel="Reativar tipo de qualificação"
                            successMessage={`${type.name} reativado.`}
                            onConfirm={setQualificationTypeActiveAction.bind(null, type.id, true)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
