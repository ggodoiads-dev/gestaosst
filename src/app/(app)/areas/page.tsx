import { Printer } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { listAreasForUser } from "@/server/services/area-view.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableCell, TableEmpty, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/domain/clickable-row";
import { Input } from "@/components/ui/input";

export default async function AreasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const areas = await listAreasForUser(user, { search: q });

  return (
    <>
      <PageHeader title="Áreas" description="Áreas da operação, com os equipamentos de cada uma e o QR Code para imprimir. Somente consulta." />
      <PageBody>
        <form className="max-w-sm">
          <Input name="q" defaultValue={q} placeholder="Buscar por nome, código ou setor..." />
        </form>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Equipamentos</TableHead>
                  <TableHead className="text-right">Colaboradores</TableHead>
                  <TableHead>QR Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.length === 0 && <TableEmpty colSpan={7} />}
                {areas.map((area) => (
                  <ClickableRow key={area.id} href={`/areas/${area.id}`}>
                    <TableCell className="font-mono text-xs">{area.code}</TableCell>
                    <TableCell className="font-medium">{area.name}</TableCell>
                    <TableCell className="text-foreground-subtle">{area.unitName}</TableCell>
                    <TableCell className="text-foreground-subtle">{area.sector ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{area.equipmentCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{area.collaboratorCount}</TableCell>
                    <TableCell>
                      {area.hasQrCode ? (
                        <a
                          href={`/areas/${area.id}/qrcode/imprimir`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        >
                          <Printer className="size-3.5" /> Imprimir
                        </a>
                      ) : (
                        <span className="text-xs text-foreground-subtle">—</span>
                      )}
                    </TableCell>
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
