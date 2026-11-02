"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TERMINATION_IMPORT_FIELDS, type TerminationImportMapping } from "@/domain/termination/import-fields";
import { TERMINATION_KIND_LABEL } from "@/domain/termination/rules";
import {
  uploadTerminationSpreadsheetAction,
  previewTerminationImportAction,
  commitTerminationImportAction,
} from "@/server/actions/termination.actions";
import type { TerminationImportRow } from "@/server/services/termination.service";
import { formatDate } from "@/lib/dates";

type Step = "upload" | "mapping" | "review" | "done";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<TerminationImportMapping>({});
  const [previewRows, setPreviewRows] = useState<TerminationImportRow[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);

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
      const res = await uploadTerminationSpreadsheetAction(formData);
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
      const res = await previewTerminationImportAction(rows, mapping);
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
      const res = await commitTerminationImportAction(previewRows);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ created: res.created, skipped: res.skipped, errors: res.errors });
      setStep("done");
    });
  }

  const toCreate = previewRows.filter((r) => r.action === "create").length;
  const withErrors = previewRows.filter((r) => r.action === "error").length;
  const skipped = previewRows.filter((r) => r.action === "skip").length;
  const unclassified = previewRows.filter((r) => r.action === "create" && r.kind === "NAO_CLASSIFICADO").length;
  const unlinked = previewRows.filter((r) => r.action === "create" && !r.collaboratorId).length;

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
            <CardDescription>Diga qual coluna da planilha corresponde a cada campo. Nome e data do desligamento são obrigatórios. Quanto mais campos (admissão, motivo, área, turno), melhor o turnover e o PDCA.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {TERMINATION_IMPORT_FIELDS.map((field) => (
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
            <Button onClick={handleBuildPreview} loading={pending} disabled={mapping.name === undefined || mapping.terminationDate === undefined}>
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
              {toCreate} desligamento(s) pronto(s) para importar{skipped > 0 ? `, ${skipped} ignorado(s) (já estão no SIGO ou repetidos)` : ""}
              {withErrors > 0 ? `, ${withErrors} com erro` : ""}.
              {unclassified > 0 ? ` ${unclassified} sem classificação de tipo: o motivo da planilha não indica pedido de demissão nem iniciativa da empresa.` : ""}
              {unlinked > 0 ? ` ${unlinked} não ligado(s) a um colaborador cadastrado (entram assim mesmo).` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead>Desligamento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.rowIndex}>
                    <TableCell className="text-foreground-subtle">{row.rowIndex + 2}</TableCell>
                    <TableCell>
                      {row.name || "—"}
                      {row.action === "create" && !row.collaboratorId && (
                        <Badge tone="warning" className="ml-1.5" title="Matrícula e nome não casaram com nenhum colaborador cadastrado.">
                          sem cadastro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground-subtle">{row.admissionDate ? formatDate(row.admissionDate) : "—"}</TableCell>
                    <TableCell>{row.terminationDate ? formatDate(row.terminationDate) : "—"}</TableCell>
                    <TableCell className="text-foreground-subtle">{TERMINATION_KIND_LABEL[row.kind].split(" (")[0]}</TableCell>
                    <TableCell className="max-w-48 truncate text-foreground-subtle" title={row.reason ?? undefined}>
                      {row.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.action === "create" && <Badge tone="success">Criar</Badge>}
                      {row.action === "skip" && <Badge tone="neutral">Ignorada: {row.skipReason}</Badge>}
                      {row.action === "error" && (
                        <Badge tone="danger" title={row.error}>
                          Erro: {row.error}
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
            <Button onClick={handleCommit} loading={pending} disabled={toCreate === 0}>
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
            <p>{result.created} desligamento(s) importado(s).</p>
            {result.skipped > 0 && <p>{result.skipped} linha(s) ignorada(s) (já estavam no SIGO ou repetidas).</p>}
            {result.errors > 0 && (
              <p className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-4" /> {result.errors} linha(s) com erro, não importada(s).
              </p>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link href="/desligamentos">Ver desligamentos e turnover</Link>
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
