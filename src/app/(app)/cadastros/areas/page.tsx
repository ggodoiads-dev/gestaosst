import Link from "next/link";
import { Printer } from "lucide-react";
import { requireUser, requirePermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listUnits, listAreas, listAreaDocuments } from "@/server/services/masterdata.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { SoftDeleteButton, ReactivateButton } from "@/components/domain/soft-delete-button";
import { setUnitActiveAction, setAreaActiveAction } from "@/server/actions/masterdata.actions";
import { CreateUnitDialog, EditUnitDialog } from "./unit-form-dialog";
import { CreateAreaDialog, EditAreaDialog } from "./area-form-dialog";
import { AreaDocumentsDialog } from "./area-documents-dialog";

export default async function AreasPage() {
  const user = await requireUser();
  requirePermission(user, PERMISSIONS.MASTERDATA_MANAGE);

  const [units, areas] = await Promise.all([listUnits(), listAreas()]);
  const areaDocuments = new Map(
    await Promise.all(areas.map(async (a) => [a.id, await listAreaDocuments(a.id)] as const)),
  );

  return (
    <>
      <PageHeader
        title="Áreas e Unidades"
        description="Estrutura organizacional utilizada para localizar equipamentos e controlar acesso."
      />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Unidades</CardTitle>
            <CreateUnitDialog />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.length === 0 && <TableEmpty colSpan={4} />}
                {units.map((unit) => (
                  <TableRow key={unit.id} className={!unit.active ? "opacity-60" : undefined}>
                    <TableCell className="font-mono text-xs">{unit.code}</TableCell>
                    <TableCell>{unit.name}</TableCell>
                    <TableCell>
                      <Badge tone={unit.active ? "success" : "neutral"}>{unit.active ? "Ativa" : "Excluída"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditUnitDialog unit={unit} />
                        {unit.active ? (
                          <SoftDeleteButton
                            title={`Excluir ${unit.name}?`}
                            description="A unidade deixa de aparecer nas listas ativas. Áreas e equipamentos já vinculados a ela continuam funcionando, e você pode reativá-la depois."
                            ariaLabel="Excluir unidade"
                            successMessage={`${unit.name} excluída.`}
                            onConfirm={setUnitActiveAction.bind(null, unit.id, false)}
                          />
                        ) : (
                          <ReactivateButton
                            ariaLabel="Reativar unidade"
                            successMessage={`${unit.name} reativada.`}
                            onConfirm={setUnitActiveAction.bind(null, unit.id, true)}
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

        <Card>
          <CardHeader>
            <CardTitle>Áreas</CardTitle>
            <CreateAreaDialog units={units} />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.length === 0 && <TableEmpty colSpan={6} />}
                {areas.map((area) => (
                  <TableRow key={area.id} className={!area.active ? "opacity-60" : undefined}>
                    <TableCell className="font-mono text-xs">{area.code}</TableCell>
                    <TableCell>{area.name}</TableCell>
                    <TableCell>{area.unit.name}</TableCell>
                    <TableCell>{area.sector ?? "—"}</TableCell>
                    <TableCell>
                      <Badge tone={area.active ? "success" : "neutral"}>
                        {area.active ? "Ativa" : "Excluída"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/areas/${area.id}/qrcode/imprimir`} target="_blank">
                            <Printer className="size-3.5" /> QR
                          </Link>
                        </Button>
                        <AreaDocumentsDialog
                          areaId={area.id}
                          areaName={area.name}
                          pop={areaDocuments.get(area.id)?.pop ?? []}
                          arVr={areaDocuments.get(area.id)?.arVr ?? []}
                          listaTreinamento={areaDocuments.get(area.id)?.listaTreinamento ?? []}
                        />
                        <EditAreaDialog area={area} units={units} />
                        {area.active ? (
                          <SoftDeleteButton
                            title={`Excluir ${area.name}?`}
                            description="A área deixa de aparecer nas listas ativas. Equipamentos e colaboradores já vinculados a ela continuam funcionando, e você pode reativá-la depois."
                            ariaLabel="Excluir área"
                            successMessage={`${area.name} excluída.`}
                            onConfirm={setAreaActiveAction.bind(null, area.id, false)}
                          />
                        ) : (
                          <ReactivateButton
                            ariaLabel="Reativar área"
                            successMessage={`${area.name} reativada.`}
                            onConfirm={setAreaActiveAction.bind(null, area.id, true)}
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
