"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IMPORT_FIELDS, type ImportMapping } from "@/domain/hr/import-fields";
import {
  uploadSpreadsheetAction,
  previewImportAction,
  commitImportAction,
  type UploadResult,
} from "@/server/actions/hr-import.actions";
import type { ImportRowResult } from "@/server/services/hr-import.service";
import { formatCurrency } from "@/lib/format";

type Step = "upload" | "mapping" | "review" | "done";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [previewRows, setPreviewRows] = useState<ImportRowResult[]>([]);
  const [result, setResult] = useState<
    { created: number; updated: number; errors: number; turnoNotFound: string[] } | null
  >(null);

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
      const res: UploadResult = await uploadSpreadsheetAction(formData);
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
      const res = await previewImportAction(rows, mapping);
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
      const res = await commitImportAction(previewRows);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ created: res.created, updated: res.updated, errors: res.errors, turnoNotFound: res.turnoNotFound });
      setStep("done");
    });
  }

  const created = previewRows.filter((r) => r.action === "create").length;
  const updated = previewRows.filter((r) => r.action === "update").length;
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
              Diga qual coluna da planilha corresponde a cada campo do sistema. Nome é obrigatório.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {IMPORT_FIELDS.map((field) => (
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
            <Button onClick={handleBuildPreview} loading={pending} disabled={mapping.name === undefined}>
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
              {created} novo(s), {updated} atualização(ões){withErrors > 0 ? `, ${withErrors} com erro` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.rowIndex}>
                    <TableCell className="text-foreground-subtle">{row.rowIndex + 2}</TableCell>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{row.matricula ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{row.jobFunction ?? "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">
                      {row.turno ? (
                        row.turnoId ? (
                          row.turno
                        ) : (
                          <Badge tone="warning" title="Nenhum turno cadastrado com esse nome — crie em /escalas.">
                            {row.turno} (não encontrado)
                          </Badge>
                        )
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{formatCurrency(row.salary)}</TableCell>
                    <TableCell>
                      {row.action === "create" && <Badge tone="success">Criar</Badge>}
                      {row.action === "update" && <Badge tone="info">Atualizar</Badge>}
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
            <Button onClick={handleCommit} loading={pending} disabled={created + updated === 0}>
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
            <p>{result.created} colaborador(es) criado(s).</p>
            <p>{result.updated} colaborador(es) atualizado(s).</p>
            {result.errors > 0 && (
              <p className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-4" /> {result.errors} linha(s) não importada(s).
              </p>
            )}
            {result.turnoNotFound.length > 0 && (
              <p className="flex items-start gap-1.5 text-warning">
                <AlertTriangle className="size-4 shrink-0 translate-y-0.5" />
                Equipe(s) sem turno cadastrado, colaborador(es) importado(s) sem essa vinculação: {result.turnoNotFound.join(", ")}.
                Crie o turno em /escalas e reimporte, ou edite o colaborador direto.
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
