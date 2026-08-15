"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/domain/stat-card";
import { DonutStat } from "@/components/domain/charts/donut-stat";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { JustifyChecklistDialog } from "@/components/domain/justify-checklist-dialog";
import { getChecklistAdherenceAction } from "@/server/actions/time-clock.actions";
import type { ChecklistAdherenceReport } from "@/server/services/time-clock.service";
import { formatDate, parseDateOnly } from "@/lib/dates";

export function ChecklistAdherenceCard({
  initialFrom,
  initialTo,
  initialReport,
}: {
  initialFrom: string;
  initialTo: string;
  initialReport: ChecklistAdherenceReport;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function fetchReport() {
    setError(null);
    startTransition(async () => {
      const res = await getChecklistAdherenceAction(from, to);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReport(res.report);
    });
  }

  const tone = report.adherencePercent >= 90 ? "success" : report.adherencePercent >= 70 ? "warning" : "danger";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aderência de Checklist (ponto)</CardTitle>
        <CardDescription>
          Dos dias em que alguém precisava fazer checklist e trabalhou, segundo o ponto importado em RH, quantos
          foram cumpridos ou justificados com um motivo que conta como cumprido.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="De" htmlFor="adherence-from">
            <Input id="adherence-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </FormField>
          <FormField label="Até" htmlFor="adherence-to">
            <Input id="adherence-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormField>
          <Button variant="secondary" onClick={fetchReport} loading={pending}>
            <Search className="size-4" /> Buscar
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
          <DonutStat
            centerLabel="aderência"
            centerValue={`${report.adherencePercent}%`}
            segments={[
              { label: "Cumpridos", value: report.compliantDays, color: tone === "danger" ? "var(--danger)" : "var(--success)" },
              { label: "Pendentes", value: Math.max(report.requiredDays - report.compliantDays, 0), color: "var(--border-strong)" },
            ]}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Aderência" value={`${report.adherencePercent}%`} tone={tone} />
            <StatCard label="Dias exigidos" value={report.requiredDays} />
            <StatCard label="Dias cumpridos" value={report.compliantDays} tone="success" />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {report.pendingDays.length === 0 ? (
          <p className="py-4 text-center text-sm text-foreground-subtle">Nenhum dia pendente no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.pendingDays.map((d, i) => (
                <TableRow key={`${d.collaboratorId}-${d.date}-${i}`}>
                  <TableCell className="whitespace-nowrap text-foreground-subtle">
                    {formatDate(parseDateOnly(d.date))}
                  </TableCell>
                  <TableCell>{d.collaboratorName}</TableCell>
                  <TableCell className="text-foreground-subtle">
                    {d.justification ? (
                      <>
                        {d.justification.reasonLabel}
                        {!d.justification.countsAsCompliant && " (não conta pra aderência)"}
                      </>
                    ) : (
                      d.detail
                    )}
                  </TableCell>
                  <TableCell>
                    <JustifyChecklistDialog
                      collaboratorId={d.collaboratorId}
                      collaboratorName={d.collaboratorName}
                      date={d.date}
                      dateLabel={formatDate(parseDateOnly(d.date))}
                      currentReason={d.justification?.reason}
                      currentNote={d.justification?.note}
                      onSaved={fetchReport}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
