import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireUser, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { listAlertsForUser } from "@/server/services/daily-digest.service";
import { ALERT_SEVERITY_LABEL, type AlertSeverity } from "@/domain/alerts/rules";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const TONE: Record<AlertSeverity, "danger" | "warning" | "info"> = { CRITICO: "danger", ALTO: "warning", ATENCAO: "info" };

export default async function AvisosPage() {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) redirect("/inicio");
  const alerts = await listAlertsForUser(user);

  return (
    <>
      <PageHeader
        title="Avisos"
        description="O que precisa de atenção hoje, por regras fixas: ASO e NR vencidos ou a vencer, não conformidades críticas ou paradas, ações vencidas e ocorrências recentes. O mesmo resumo pode chegar por e-mail todo dia de manhã."
      />
      <PageBody>
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-8 text-sm text-foreground-muted">
              <CheckCircle2 className="size-5 text-success" /> Nenhuma regra de aviso foi disparada agora.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((a) => (
              <Card key={a.key}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={TONE[a.severity]}>{ALERT_SEVERITY_LABEL[a.severity]}</Badge>
                      <span className="text-sm font-semibold text-foreground">{a.title}</span>
                    </div>
                    <p className="text-sm text-foreground-muted">{a.detail}</p>
                  </div>
                  <Link href={a.href} className="text-sm font-medium text-accent hover:underline">
                    Abrir
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
