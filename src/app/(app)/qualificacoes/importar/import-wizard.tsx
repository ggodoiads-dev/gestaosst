"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QUALIFICATION_IMPORT_FIELDS, type QualificationImportMapping } from "@/domain/qualification/import-fields";
import {
  uploadQualificationSpreadsheetAction,
  previewQualificationImportAction,
  commitQualificationImportAction,
  type UploadResult,
} from "@/server/actions/qualification-import.actions";
import type { QualificationImportRowResult } from "@/server/services/qualification-import.service";
import { formatDate } from "@/lib/dates";

type Step = "upload" | "mapping" | "review" | "done";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<QualificationImportMapping>({});
  const [previewRows, setPreviewRows] = useState<QualificationImportRowResult[]>([]);
  const [result, setResult] = useState<{ created: number; duplicates: number; errors: number } | null>(null);

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
      const res: UploadResult = await uploadQualificationSpreadsheetAction(formData);
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
      const res = await previewQualificationImportAction(rows, mapping);
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
      const res = await commitQualificationImportAction(previewRows);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ created: res.created, duplicates: res.duplicates, errors: res.errors });
      setStep("done");
    });
  }

  const creatable = previewRows.filter((r) => r.action === "create").length;
  const duplicates = previewRows.filter((r) => r.action === "duplicate").length;
  const withErrors = previewRows.filter((r) => r.action === "error").length;

  return (
    <Card>
      {step === "upload" && (
        <>
          <CardHeader>
            <CardTitle>1. Enviar planilha</CardTitle>
            <CardDescription>Formatos aceitos: .xlsx ou .csv. Só a primeira planilha do arquivo é lida.</CardDescription>
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
            <CardDescription>
              Diga qual coluna da planilha corresponde a cada campo do sistema. Colaborador, Treinamento e Data de
              realização são obrigatórios. Se o treinamento ainda não existir no sistema, ele é cadastrado
              automaticamente usando a Categoria e a Validade em meses dessa linha.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {QUALIFICATION_IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-foreground-muted">
                    {field.label}
                    {field.required && <span className="text-danger ml-0.5">*</span>}
                  </label>
                  <Select
                    value={mapping[field.key] !== undefined ? String(mapping[field.key]) : "none"}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [field.key]: v === "none" ? undefined : Number(v) }))
                    }
                  >
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
                <p className="mb-1.5 text-xs font-medium text-foreground-subtle">
                  Prévia — {rows.length} linha(s) na planilha
                </p>
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
                          <TableCell key={j} className="text-foreground-subtle">
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
            <Button
              onClick={handleBuildPreview}
              loading={pending}
              disabled={
                mapping.name === undefined || mapping.qualificationType === undefined || mapping.completedDate === undefined
              }
            >
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
              {creatable} novo(s), {duplicates} já existente(s) (ignorado(s))
              {withErrors > 0 ? `, ${withErrors} com erro` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula/CPF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Conclusão</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.rowIndex}>
                    <TableCell className="text-foreground-subtle">{row.rowIndex + 2}</TableCell>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{row.matricula ?? row.cpf ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">
                      {row.qualificationType ? (
                        <span className="inline-flex items-center gap-1.5">
                          {row.qualificationType}
                          {!row.qualificationTypeId && row.action !== "error" && (
                            <Badge tone="info" title="Esse treinamento ainda não existe — será cadastrado automaticamente.">
                              Novo
                            </Badge>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">
                      {row.completedDate ? formatDate(`${row.completedDate}T12:00:00`) : "—"}
                    </TableCell>
                    <TableCell>
                      {row.action === "create" && <Badge tone="success">Criar</Badge>}
                      {row.action === "duplicate" && <Badge tone="neutral">Já existe</Badge>}
                      {row.action === "error" && (
                        <Badge tone="danger" title={row.error}>
                          Erro
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
            <Button onClick={handleCommit} loading={pending} disabled={creatable === 0}>
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
            <p>{result.created} registro(s) criado(s).</p>
            {result.duplicates > 0 && <p>{result.duplicates} já existia(m) e foi(ram) ignorado(s).</p>}
            {result.errors > 0 && (
              <p className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-4" /> {result.errors} linha(s) não importada(s).
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button
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
