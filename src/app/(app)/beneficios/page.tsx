import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { requireUser } from "@/server/auth/current-user";
import { getMonthlyBenefits } from "@/server/services/benefits.service";
import { PageHeader, PageBody } from "@/components/domain/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function BeneficiosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;
  const now = new Date();
  const month = Number(monthParam) || now.getMonth() + 1;
  const year = Number(yearParam) || now.getFullYear();

  const user = await requireUser();
  const benefits = await getMonthlyBenefits(user, { month, year });

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const assessmentFromLabel = `${MONTH_LABELS[(month - 3 + 12) % 12]}`;
  const assessmentToLabel = `${MONTH_LABELS[(month - 2 + 12) % 12]}`;

  return (
    <>
      <PageHeader
        title="Benefícios"
        description={`Dias de benefício e direito à cesta básica de cada colaborador — apuração de descontos de 21/${assessmentFromLabel.slice(0, 3)} a 20/${assessmentToLabel.slice(0, 3)}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" asChild>
              <Link href={`/beneficios?month=${prevMonth}&year=${prevYear}`} aria-label="Mês anterior">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <span className="min-w-32 text-center text-sm font-medium text-foreground">
              {MONTH_LABELS[month - 1]} de {year}
            </span>
            <Button size="icon" variant="secondary" asChild>
              <Link href={`/beneficios?month=${nextMonth}&year=${nextYear}`} aria-label="Próximo mês">
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/api/beneficios/export?month=${month}&year=${year}`}>
                <Download className="size-3.5" /> Exportar Excel
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Dias programados (mês cheio)</TableHead>
                  <TableHead>Faltas injustificadas (apuração)</TableHead>
                  <TableHead>Dias de benefício</TableHead>
                  <TableHead>Advertência na apuração</TableHead>
                  <TableHead>Cesta básica</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benefits.length === 0 && <TableEmpty colSpan={7} />}
                {benefits.map((b) => (
                  <TableRow key={b.collaboratorId}>
                    <TableCell>{b.collaboratorName}</TableCell>
                    <TableCell className="text-foreground-subtle">{b.matricula ?? "—"}</TableCell>
                    <TableCell>{b.scheduledDays}</TableCell>
                    <TableCell className={b.unjustifiedFaltas > 0 ? "text-danger" : undefined}>
                      {b.unjustifiedFaltas}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">{b.benefitDays}</TableCell>
                    <TableCell>
                      {b.hasWarning ? <Badge tone="danger">Sim</Badge> : <Badge tone="neutral">Não</Badge>}
                    </TableCell>
                    <TableCell>
                      {b.cestaBasica ? <Badge tone="success">Tem direito</Badge> : <Badge tone="danger">Perdeu</Badge>}
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
