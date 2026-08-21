"use client";

import { useState, useTransition } from "react";
import { Search, Link2, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  getTimeClockReportAction,
  getChecklistAdherenceAction,
  getUnmatchedTimeClockPisAction,
  linkTimeClockPisAction,
  ignoreTimeClockPisAction,
  ignoreAllUnmatchedTimeClockPisAction,
} from "@/server/actions/time-clock.actions";
import type {
  TimeClockAnomaly,
  TimeClockAnomalyType,
  ChecklistAdherenceReport,
  UnmatchedTimeClockPis,
} from "@/server/services/time-clock.service";
import { JustifyChecklistDialog } from "@/components/domain/justify-checklist-dialog";
import { ScheduleDayNoteDialog } from "@/app/(app)/escalas/schedule-day-note-dialog";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/dates";

const ANOMALY_LABELS: Record<TimeClockAnomalyType, string> = {
  ATRASO: "Atraso",
  FALTA: "Falta",
  CHECKLIST_PENDENTE: "Checklist não realizado",
  BATIDA_IMPAR: "Batida ímpar",
};

const ANOMALY_TONES: Record<TimeClockAnomalyType, "danger" | "warning" | "info"> = {
  FALTA: "danger",
  ATRASO: "warning",
  BATIDA_IMPAR: "warning",
  CHECKLIST_PENDENTE: "info",
};

type TratativaPontoPanelProps = {
  initialFrom: string;
  initialTo: string;
  initialAnomalies: TimeClockAnomaly[];
  initialAdherence: ChecklistAdherenceReport;
  initialUnmatchedPis: UnmatchedTimeClockPis[];
  collaborators: { id: string; name: string }[];
};

export function TratativaPontoPanel({
  initialFrom,
  initialTo,
  initialAnomalies,
  initialAdherence,
  initialUnmatchedPis,
  collaborators,
}: TratativaPontoPanelProps) {
  const [loadingReport, startReport] = useTransition();
  const [linking, startLink] = useTransition();
  const [linkingPis, setLinkingPis] = useState<string | null>(null);
  const [ignoring, startIgnore] = useTransition();
  const [ignoringPis, setIgnoringPis] = useState<string | null>(null);
  const [ignoringAll, startIgnoreAll] = useTransition();

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [reportError, setReportError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<TimeClockAnomaly[]>(initialAnomalies);
  const [adherence, setAdherence] = useState<ChecklistAdherenceReport>(initialAdherence);
  const [unmatchedPis, setUnmatchedPis] = useState<UnmatchedTimeClockPis[]>(initialUnmatchedPis);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Record<string, string>>({});
  const [justifyFalta, setJustifyFalta] = useState<{ collaboratorId: string; collaboratorName: string; date: string } | null>(null);

  const justificationByKey = new Map(
    adherence.pendingDays.map((d) => [`${d.collaboratorId}-${d.date}`, d.justification]),
  );

  function fetchReport() {
    setReportError(null);
    startReport(async () => {
      const [reportRes, adherenceRes] = await Promise.all([
        getTimeClockReportAction(from, to),
        getChecklistAdherenceAction(from, to),
      ]);
      if (!reportRes.ok) {
        setReportError(reportRes.error);
        return;
      }
      setAnomalies(reportRes.anomalies);
      if (adherenceRes.ok) setAdherence(adherenceRes.report);
    });
  }

  function refreshUnmatched() {
    startReport(async () => {
      const unmatchedRes = await getUnmatchedTimeClockPisAction();
      if (unmatchedRes.ok) setUnmatchedPis(unmatchedRes.items);
    });
  }

  function handleLink(pis: string) {
    const collaboratorId = selectedCollaborator[pis];
    if (!collaboratorId) {
      toast.error("Selecione um colaborador.");
      return;
    }
    setLinkingPis(pis);
    startLink(async () => {
      const res = await linkTimeClockPisAction(pis, collaboratorId);
      setLinkingPis(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.linkedRecords} marcação(ões) vinculada(s).`);
      setUnmatchedPis((prev) => prev.filter((u) => u.pis !== pis));
      fetchReport();
    });
  }

  function handleIgnore(pis: string) {
    setIgnoringPis(pis);
    startIgnore(async () => {
      const res = await ignoreTimeClockPisAction(pis);
      setIgnoringPis(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setUnmatchedPis((prev) => prev.filter((u) => u.pis !== pis));
    });
  }

  function handleIgnoreAll() {
    startIgnoreAll(async () => {
      const res = await ignoreAllUnmatchedTimeClockPisAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.ignoredCount} código(s) ignorado(s).`);
      setUnmatchedPis([]);
    });
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" loading={loadingReport} onClick={refreshUnmatched}>
          Atualizar batidas não identificadas
        </Button>
      </div>

      {unmatchedPis.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Batidas não identificadas ({unmatchedPis.length})</CardTitle>
                <CardDescription>
                  O arquivo do relógio não traz nome, só esse código — escolha o colaborador certo pra cada
                  um, ou ignore se for sobra de arquivo antigo/código de erro do relógio.
                </CardDescription>
              </div>
              <Button size="sm" variant="secondary" loading={ignoringAll} onClick={handleIgnoreAll}>
                <EyeOff className="size-4" /> Ignorar todos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código do relógio</TableHead>
                  <TableHead>Marcações</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="w-52" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedPis.map((u) => (
                  <TableRow key={u.pis}>
                    <TableCell className="font-mono text-xs">{u.pis}</TableCell>
                    <TableCell className="text-foreground-subtle">{u.recordCount}</TableCell>
                    <TableCell className="text-foreground-subtle whitespace-nowrap">
                      {formatDateTime(u.firstTimestamp)} — {formatDateTime(u.lastTimestamp)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={selectedCollaborator[u.pis] ?? ""}
                        onValueChange={(v) => setSelectedCollaborator((prev) => ({ ...prev, [u.pis]: v }))}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {collaborators.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={linking && linkingPis === u.pis}
                          disabled={!selectedCollaborator[u.pis]}
                          onClick={() => handleLink(u.pis)}
                        >
                          <Link2 className="size-4" /> Vincular
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={ignoring && ignoringPis === u.pis}
                          onClick={() => handleIgnore(u.pis)}
                          aria-label="Ignorar código"
                        >
                          <EyeOff className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {unmatchedPis.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-foreground-subtle">
            Nenhuma batida não identificada no momento.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ocorrências</CardTitle>
          <CardDescription>Atraso, falta, checklist não realizado e batida ímpar no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="De" htmlFor="ponto-from">
              <Input id="ponto-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </FormField>
            <FormField label="Até" htmlFor="ponto-to">
              <Input id="ponto-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </FormField>
            <Button variant="secondary" onClick={fetchReport} loading={loadingReport}>
              <Search className="size-4" /> Buscar
            </Button>
          </div>

          {reportError && <p className="text-sm text-danger">{reportError}</p>}

          {anomalies.length === 0 && !loadingReport && (
            <p className="py-6 text-center text-sm text-foreground-subtle">
              Nenhuma ocorrência no período selecionado.
            </p>
          )}

          {anomalies.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Ocorrência</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((a, i) => {
                  const justification =
                    a.type === "CHECKLIST_PENDENTE" ? justificationByKey.get(`${a.collaboratorId}-${a.date}`) : undefined;
                  return (
                    <TableRow key={`${a.collaboratorId}-${a.date}-${a.type}-${i}`}>
                      <TableCell className="whitespace-nowrap text-foreground-subtle">{formatDate(parseDateOnly(a.date))}</TableCell>
                      <TableCell>{a.collaboratorName}</TableCell>
                      <TableCell>
                        <Badge tone={ANOMALY_TONES[a.type]}>{ANOMALY_LABELS[a.type]}</Badge>
                      </TableCell>
                      <TableCell className="text-foreground-subtle">
                        {a.detail}
                        {justification && (
                          <span className="mt-0.5 block text-xs text-foreground-subtle">
                            Justificado: {justification.reasonLabel}
                            {!justification.countsAsCompliant && " (não conta pra aderência)"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.type === "CHECKLIST_PENDENTE" && (
                          <JustifyChecklistDialog
                            collaboratorId={a.collaboratorId}
                            collaboratorName={a.collaboratorName}
                            date={a.date}
                            dateLabel={formatDate(parseDateOnly(a.date))}
                            currentReason={justification?.reason}
                            currentNote={justification?.note}
                            onSaved={fetchReport}
                          />
                        )}
                        {a.type === "FALTA" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setJustifyFalta({ collaboratorId: a.collaboratorId, collaboratorName: a.collaboratorName, date: a.date })
                            }
                          >
                            Justificar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {justifyFalta && (
        <ScheduleDayNoteDialog
          collaboratorId={justifyFalta.collaboratorId}
          collaboratorName={justifyFalta.collaboratorName}
          date={justifyFalta.date}
          computed="TRABALHO"
          note={null}
          onClose={() => {
            setJustifyFalta(null);
            fetchReport();
          }}
        />
      )}
    </>
  );
}
