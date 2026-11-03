"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { INTERVIEW_IMPORT_FIELDS, type InterviewImportMapping } from "@/domain/termination/interview-import";
import { exitReasonLabel } from "@/domain/termination/interview";
import { uploadInterviewSpreadsheetAction, previewInterviewImportAction, commitInterviewImportAction } from "@/server/actions/exit-interview-import.actions";
import type { InterviewImportRow } from "@/server/services/exit-interview-import.service";
import { formatDate } from "@/lib/dates";

type Step = "upload" | "mapping" | "review" | "done";

export function InterviewImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<InterviewImportMapping>({});
  const [previewRows, setPreviewRows] = useState<InterviewImportRow[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: number } | null>(null);

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const res = await uploadInterviewSpreadsheetAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHeaders(res.headers);
      setRows(res.rows);
      setMapping(res.suggestedMapping);
      setStep("mapping");
    });
  }

  function handleBuildPreview() {
    setError(null);
    startTransition(async () => {
      const res = await previewInterviewImportAction(rows, mapping);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreviewRows(res.rows);
      setStep("review");
    });
  }

  function handleCommit() {
    setError(null);
    startTransition(async () => {
      const res = await commitInterviewImportAction(previewRows);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ created: res.created, updated: res.updated, skipped: res.skipped, errors: res.errors });
      setStep("done");
    });
  }

  const toCreate = previewRows.filter((r) => r.action === "create").length;
  const toUpdate = previewRows.filter((r) => r.action === "update").length;
  const withErrors = previewRows.filter((r) => r.action === "error").length;
  const skipped = previewRows.filter((r) => r.action === "skip").length;
  const asOther = previewRows.filter((r) => (r.action === "create" || r.action === "update") && r.primaryReason === "OUTRO").length;

  return (
    <Card>
      {step === "upload" && (
        <>
          <CardHeader>
            <CardTitle>1. Enviar planilha</CardTitle>
            <CardDescription>Formatos aceitos: .xlsx ou .csv. Só a primeira planilha do arquivo é lida, com os títulos na primeira linha.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="text-sm" />
            {error && <p className="text-sm text-danger">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button onClick={handleUpload} loading={pending}>
              <Upload className="size-4" /> Enviar e ler colunas
            </Button>
          </CardFooter>
        </>
      )}

      {step === "mapping" && (
        <>
          <CardHeader>
            <CardTitle>2. Mapear colunas</CardTitle>
            <CardDescription>Diga qual coluna da planilha corresponde a cada campo. Nome e motivo principal são obrigatórios; os demais enriquecem o PDCA (notas, se voltaria, outros fatores).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {INTERVIEW_IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-foreground-muted">
                    {field.label}
                    {field.required && <span className="ml-0.5 text-danger">*</span>}
                  </label>
                  <Select value={mapping[field.key] !== undefined ? String(mapping[field.key]) : "none"} onValueChange={(v) => setMapping((prev) => ({ ...prev, [field.key]: v === "none" ? undefined : Number(v) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma coluna</SelectItem>
                      {headers.map((h, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {h || `Coluna ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {rows.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground-subtle">Prévia — {rows.length} linha(s) na planilha</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, idx) => (
                        <TableHead key={idx}>{h || `Coluna ${idx + 1}`}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} className="max-w-48 truncate text-foreground-subtle">
                            {cell || "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="secondary" onClick={() => setStep("upload")}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
            <Button onClick={handleBuildPreview} loading={pending} disabled={mapping.name === undefined || mapping.primaryReason === undefined}>
              Revisar importação <ArrowRight className="size-4" />
            </Button>
          </CardFooter>
        </>
      )}

      {step === "review" && (
        <>
          <CardHeader>
            <CardTitle>3. Revisar e confirmar</CardTitle>
            <CardDescription>
              {toCreate} nova(s) entrevista(s){toUpdate > 0 ? `, ${toUpdate} para atualizar (a pessoa já tinha entrevista)` : ""}
              {withErrors > 0 ? `, ${withErrors} com erro (geralmente: o desligamento ainda não foi importado)` : ""}
              {skipped > 0 ? `, ${skipped} ignorada(s)` : ""}.
              {asOther > 0 ? ` ${asOther} caíram em Outro porque o texto do motivo não tem palavra conhecida; o texto original foi guardado no resumo.` : ""} Confira a coluna Classificado como.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Desligamento</TableHead>
                  <TableHead>Motivo escrito</TableHead>
                  <TableHead>Classificado como</TableHead>
                  <TableHead>Voltaria</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.rowIndex}>
                    <TableCell className="text-foreground-subtle">{row.rowIndex + 2}</TableCell>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{row.terminationDate ? formatDate(row.terminationDate) : "—"}</TableCell>
                    <TableCell className="max-w-56 truncate text-foreground-subtle" title={row.primaryText ?? undefined}>
                      {row.primaryText ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.primaryReason ? (
                        <>
                          {exitReasonLabel(row.primaryReason)}
                          {row.secondaryReasons.length > 0 && <span className="block text-[11px] text-foreground-subtle">+ {row.secondaryReasons.map(exitReasonLabel).join(", ")}</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{row.wouldReturn === "SIM" ? "Sim" : row.wouldReturn === "NAO" ? "Não" : row.wouldReturn === "TALVEZ" ? "Talvez" : "—"}</TableCell>
                    <TableCell>
                      {row.action === "create" && <Badge tone="success">Criar</Badge>}
                      {row.action === "update" && <Badge tone="info">Atualizar</Badge>}
                      {row.action === "skip" && <Badge tone="neutral">Ignorada</Badge>}
                      {row.action === "error" && (
                        <Badge tone="danger" title={row.error}>
                          {row.error}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {error && <p className="p-4 text-sm text-danger">{error}</p>}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="secondary" onClick={() => setStep("mapping")}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
            <Button onClick={handleCommit} loading={pending} disabled={toCreate + toUpdate === 0}>
              Confirmar importação
            </Button>
          </CardFooter>
        </>
      )}

      {step === "done" && result && (
        <>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-success" /> Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-foreground-subtle">
            <p>
              {result.created} entrevista(s) nova(s){result.updated > 0 ? `, ${result.updated} atualizada(s)` : ""}.
            </p>
            {result.errors > 0 && (
              <p className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-4" /> {result.errors} linha(s) não importada(s).
              </p>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link href="/desligamentos/pdca">Ver no PDCA</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setStep("upload");
                setHeaders([]);
                setRows([]);
                setMapping({});
                setPreviewRows([]);
                setResult(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Importar outra planilha
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
