import { requireUser } from "@/server/auth/current-user";
import { listEpiTypes } from "@/server/services/epi.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SoftDeleteButton, ReactivateButton } from "@/components/domain/soft-delete-button";
import { setEpiTypeActiveAction } from "@/server/actions/epi.actions";
import { CreateEpiTypeDialog, EditEpiTypeDialog } from "./epi-type-form-dialog";

export default async function TiposEpiCadastroPage() {
  const user = await requireUser();
  const types = await listEpiTypes(user);

  return (
    <>
      <PageHeader
        title="Tipos de EPI"
        description="Catálogo de Equipamentos de Proteção Individual usado nas fichas de entrega e nos kits por função."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Tipos ({types.length})</CardTitle>
            <CreateEpiTypeDialog />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CA padrão</TableHead>
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
                    <TableCell className="text-foreground-subtle">{type.defaultCa || "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">
                      {type.validityMonths ? `${type.validityMonths} meses` : "Não expira"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={type.active ? "success" : "neutral"}>{type.active ? "Ativo" : "Excluído"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditEpiTypeDialog type={type} />
                        {type.active ? (
                          <SoftDeleteButton
                            title={`Excluir ${type.name}?`}
                            description="Deixa de aparecer nas listas ativas pra registrar novas entregas e kits. Entregas já registradas com esse tipo continuam disponíveis, e você pode reativá-lo depois."
                            ariaLabel="Excluir tipo de EPI"
                            successMessage={`${type.name} excluído.`}
                            onConfirm={setEpiTypeActiveAction.bind(null, type.id, false)}
                          />
                        ) : (
                          <ReactivateButton
                            ariaLabel="Reativar tipo de EPI"
                            successMessage={`${type.name} reativado.`}
                            onConfirm={setEpiTypeActiveAction.bind(null, type.id, true)}
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
