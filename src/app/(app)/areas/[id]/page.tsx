import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FileText, Printer } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getAreaForView } from "@/server/services/area-view.service";
import type { AreaPublicDoc } from "@/server/services/masterdata.service";
import { generateAreaQrCode } from "@/server/services/qrcode.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { StatCard } from "@/components/domain/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EquipmentStatusBadge } from "@/components/domain/status-badges";
import { attachmentUrl } from "@/lib/attachment-url";
import { formatDate } from "@/lib/dates";

export default async function AreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const data = await getAreaForView(user, id);
  if (!data) notFound();
  const { area, collaboratorCount, documents } = data;

  let qrDataUrl: string | null = null;
  let qrUrl: string | null = null;
  if (area.qrToken) {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
    const protocol = headerList.get("x-forwarded-proto") ?? "http";
    qrUrl = `${protocol}://${host}/q/${area.qrToken}`;
    qrDataUrl = await generateAreaQrCode(area.qrToken, `${protocol}://${host}`);
  }

  const docTypes = (d: { pop: AreaPublicDoc | null; arVr: AreaPublicDoc | null; listaTreinamento: AreaPublicDoc | null }) => [
    { label: "POP", doc: d.pop },
    { label: "AR/VR", doc: d.arVr },
    { label: "Lista de Treinamento", doc: d.listaTreinamento },
  ];
  const docGroups = [
    ...documents.activities.map((a) => ({ key: a.id, title: a.name, docs: docTypes(a) })),
    ...(documents.general ? [{ key: "geral", title: "Documentos gerais da área", docs: docTypes(documents.general) }] : []),
  ];

  return (
    <>
      <PageHeader
        title={area.name}
        description={`${area.code} · ${area.unit.name}${area.sector ? ` · ${area.sector}` : ""}`}
        actions={
          area.qrToken ? (
            <Button asChild size="sm" variant="secondary">
              <a href={`/areas/${area.id}/qrcode/imprimir`} target="_blank" rel="noreferrer">
                <Printer className="size-4" /> Imprimir QR Code
              </a>
            </Button>
          ) : undefined
        }
      />
      <PageBody className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Equipamentos" value={area.equipments.length} />
            <StatCard label="Colaboradores ativos" value={collaboratorCount} />
            <StatCard
              label="Equipamentos bloqueados"
              value={area.equipments.filter((e) => e.status === "BLOQUEADO").length}
              tone={area.equipments.some((e) => e.status === "BLOQUEADO") ? "danger" : "success"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liderança da área</CardTitle>
              <CardDescription>Quem faz a chamada desta área. Aparece em destaque no QR Code.</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.leaders.length === 0 ? (
                <p className="text-sm text-foreground-subtle">Nenhuma liderança configurada (Usuários e Permissões, “Faz chamada?”).</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {documents.leaders.map((l) => (
                    <li key={l.name} className="rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm">
                      <span className="font-medium text-foreground">{l.name}</span>
                      {l.turnos.length > 0 && <span className="text-foreground-subtle"> · Turno {l.turnos.join(" / ")}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentos por atividade</CardTitle>
              <CardDescription>
                O mais recente de cada tipo, separado por atividade — é o que aparece para quem escaneia o QR Code. As atividades da área
                são escolhidas na tela da própria atividade.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {docGroups.length === 0 && <p className="text-sm text-foreground-subtle">Nenhuma atividade ligada a esta área.</p>}
              {docGroups.map((g) => (
                <div key={g.key} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{g.title}</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {g.docs.map(({ label, doc }) => (
                      <div key={label}>
                        <p className="text-[11px] font-semibold text-foreground-subtle">{label}</p>
                        {doc ? (
                          <a href={attachmentUrl(doc.path)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-accent hover:underline">
                            <FileText className="size-4 shrink-0" />
                            <span className="truncate">{doc.filename}</span>
                          </a>
                        ) : (
                          <p className="text-sm text-foreground-subtle">Não enviado.</p>
                        )}
                        {doc && <p className="text-[11px] text-foreground-subtle">Enviado em {formatDate(doc.uploadedAt)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Equipamentos da área ({area.equipments.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {area.equipments.length === 0 ? (
                <p className="px-4 py-6 text-sm text-foreground-subtle">Nenhum equipamento nesta área.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {area.equipments.map((e) => (
                    <li key={e.id}>
                      <Link href={`/equipamentos/${e.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted">
                        <span className="min-w-0">
                          <span className="font-mono text-xs text-foreground-subtle">{e.code}</span>{" "}
                          <span className="text-foreground">{e.name}</span>
                          <span className="block text-xs text-foreground-subtle">{e.type.name}</span>
                        </span>
                        <EquipmentStatusBadge status={e.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>QR Code da área</CardTitle>
            <CardDescription>Quem escaneia vê os documentos da área e os colaboradores, sem precisar de login.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            {qrDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt={`QR Code da área ${area.code}`} className="size-52 rounded-md border border-border bg-white p-2" />
                <p className="break-all text-center text-[10px] text-foreground-subtle">{qrUrl}</p>
                <Button asChild size="sm" className="w-full">
                  <a href={`/areas/${area.id}/qrcode/imprimir`} target="_blank" rel="noreferrer">
                    <Printer className="size-4" /> Imprimir
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-foreground-subtle">Esta área ainda não tem QR Code gerado.</p>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
