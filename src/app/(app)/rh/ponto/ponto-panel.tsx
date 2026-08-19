"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, AlertTriangle, CheckCircle2, Search, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  uploadAfdtAction,
  getTimeClockReportAction,
  getChecklistAdherenceAction,
  getUnmatchedTimeClockPisAction,
  linkTimeClockPisAction,
} from "@/server/actions/time-clock.actions";
import type {
  TimeClockAnomaly,
  TimeClockAnomalyType,
  TimeClockImportSummary,
  ChecklistAdherenceReport,
  UnmatchedTimeClockPis,
} from "@/server/services/time-clock.service";
import { JustifyChecklistDialog } from "@/components/domain/justify-checklist-dialog";
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

type PontoPanelProps = {
  initialFrom: string;
  initialTo: string;
  initialAnomalies: TimeClockAnomaly[];
  initialAdherence: ChecklistAdherenceReport;
  initialUnmatchedPis: UnmatchedTimeClockPis[];
  collaborators: { id: string; name: string }[];
};

export function PontoPanel({
  initialFrom,
  initialTo,
  initialAnomalies,
  initialAdherence,
  initialUnmatchedPis,
  collaborators,
}: PontoPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [loadingReport, startReport] = useTransition();
  const [linking, startLink] = useTransition();
  const [linkingPis, setLinkingPis] = useState<string | null>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TimeClockImportSummary | null>(null);

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [reportError, setReportError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<TimeClockAnomaly[]>(initialAnomalies);
  const [adherence, setAdherence] = useState<ChecklistAdherenceReport>(initialAdherence);
  const [unmatchedPis, setUnmatchedPis] = useState<UnmatchedTimeClockPis[]>(initialUnmatchedPis);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Record<string, string>>({});

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

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Selecione um arquivo.");
      return;
    }
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    startUpload(async () => {
      const res = await uploadAfdtAction(formData);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      setSummary(res.summary);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchReport();
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Importar arquivo AFDT</CardTitle>
          <CardDescription>
            Envie o arquivo .txt do relógio de ponto (padrão Portaria 671/2021). As batidas são identificadas
            pelo PIS de cada colaborador (código de 11 dígitos, diferente da matrícula) — garanta que o PIS
            esteja cadastrado em RH antes de importar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input ref={fileInputRef} type="file" accept=".txt" className="text-sm" />
          {uploadError && <p className="text-sm text-danger">{uploadError}</p>}
          {summary && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm">
              <p className="flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="size-4 text-success" /> {summary.totalRecords} marcação(ões) lida(s),{" "}
                {summary.matched} identificada(s).
              </p>
              {summary.unmatched > 0 && (
                <p className="flex items-start gap-1.5 text-warning">
                  <AlertTriangle className="size-4 shrink-0 translate-y-0.5" />
                  <span>
                    {summary.unmatched} marcação(ões) de {summary.unmatchedPis.length} colaborador(es) não
                    identificado(s). Vincule manualmente cada código no quadro &ldquo;Batidas não
                    identificadas&rdquo; abaixo, ou cadastre o PIS certo em RH e reimporte o arquivo.
                  </span>
                </p>
              )}
              {summary.ignoredLines > 0 && (
                <p className="text-xs text-foreground-subtle">
                  {summary.ignoredLines} linha(s) do arquivo não reconhecida(s) e ignorada(s).
                </p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpload} loading={uploading}>
            <Upload className="size-4" /> Enviar arquivo
          </Button>
        </CardFooter>
      </Card>

      {unmatchedPis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Batidas não identificadas ({unmatchedPis.length})</CardTitle>
            <CardDescription>
              O arquivo do relógio não traz nome, só esse código — escolha o colaborador certo pra cada um.
              Depois de vincular, o código vira o PIS dele e todo o histórico já importado se ajusta sozinho.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código do relógio</TableHead>
                  <TableHead>Marcações</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="w-24" />
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
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={linking && linkingPis === u.pis}
                        disabled={!selectedCollaborator[u.pis]}
                        onClick={() => handleLink(u.pis)}
                      >
                        <Link2 className="size-4" /> Vincular
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
