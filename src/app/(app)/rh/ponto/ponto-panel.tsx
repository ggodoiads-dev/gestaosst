"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { uploadAfdtAction, getTimeClockReportAction } from "@/server/actions/time-clock.actions";
import type { TimeClockAnomaly, TimeClockAnomalyType, TimeClockImportSummary } from "@/server/services/time-clock.service";
import { formatDate, parseDateOnly } from "@/lib/dates";

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
};

export function PontoPanel({ initialFrom, initialTo, initialAnomalies }: PontoPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [loadingReport, startReport] = useTransition();

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TimeClockImportSummary | null>(null);

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [reportError, setReportError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<TimeClockAnomaly[]>(initialAnomalies);

  function fetchReport() {
    setReportError(null);
    startReport(async () => {
      const res = await getTimeClockReportAction(from, to);
      if (!res.ok) {
        setReportError(res.error);
        return;
      }
      setAnomalies(res.anomalies);
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
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Importar arquivo AFDT</CardTitle>
          <CardDescription>
            Envie o arquivo .txt exportado do relógio de ponto (padrão Portaria 671/2021). O casamento com o
            colaborador é feito pelo PIS — cadastre o PIS de cada colaborador em RH pra que as batidas sejam
            identificadas.
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
                    identificado(s) — PIS: {summary.unmatchedPis.join(", ")}. Cadastre o PIS certo em RH e
                    reimporte o mesmo arquivo.
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((a, i) => (
                  <TableRow key={`${a.collaboratorId}-${a.date}-${a.type}-${i}`}>
                    <TableCell className="whitespace-nowrap text-foreground-subtle">{formatDate(parseDateOnly(a.date))}</TableCell>
                    <TableCell>{a.collaboratorName}</TableCell>
                    <TableCell>
                      <Badge tone={ANOMALY_TONES[a.type]}>{ANOMALY_LABELS[a.type]}</Badge>
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{a.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
