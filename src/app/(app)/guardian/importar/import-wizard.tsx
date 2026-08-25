"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { uploadGuardianSpreadsheetAction, commitGuardianImportAction } from "@/server/actions/guardian-import.actions";
import type { GuardianImportRow } from "@/server/services/guardian-import.service";
import { GUARDIAN_TYPE_LABELS } from "@/domain/guardian/labels";
import { formatDate } from "@/lib/dates";

export function ImportWizard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<GuardianImportRow[] | null>(null);
  const [committing, startCommit] = useTransition();
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadGuardianSpreadsheetAction(formData);
    setUploading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRows(res.rows);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleCommit() {
    if (!rows) return;
    startCommit(async () => {
      const res = await commitGuardianImportAction(rows);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult({ created: res.created, skipped: res.skipped });
      toast.success(`${res.created} relato(s) importado(s).`);
    });
  }

  const toCreate = rows?.filter((r) => r.action === "create") ?? [];
  const duplicates = rows?.filter((r) => r.action === "skip-duplicate") ?? [];
  const notLog20 = rows?.filter((r) => r.action === "skip-not-log20") ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Enviar planilha</CardTitle>
          <CardDescription>O arquivo .xlsx exportado direto do Guardian, com as abas comportamento_risco, condicao, incidente e reconhecimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
            {!uploading && <Upload className="size-4" />}
            Escolher arquivo
          </Button>
        </CardContent>
      </Card>

      {rows && (
        <Card>
          <CardHeader>
            <CardTitle>2. Prévia ({rows.length} linha(s) na planilha)</CardTitle>
            <CardDescription>
              Só entram no SIGO os relatos de gente já cadastrada como colaborador ativo/inativo da LOG20 (casado por CPF ou nome) que ainda não foram importados antes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-md border border-border px-3 py-2.5">
                <p className="text-xs text-foreground-subtle">Novos — serão importados</p>
                <p className="text-lg font-semibold text-success tabular-nums">{toCreate.length}</p>
              </div>
              <div className="rounded-md border border-border px-3 py-2.5">
                <p className="text-xs text-foreground-subtle">Já importados antes</p>
                <p className="text-lg font-semibold text-foreground-subtle tabular-nums">{duplicates.length}</p>
              </div>
              <div className="rounded-md border border-border px-3 py-2.5">
                <p className="text-xs text-foreground-subtle">Não são da LOG20 (ignorados)</p>
                <p className="text-lg font-semibold text-foreground-subtle tabular-nums">{notLog20.length}</p>
              </div>
            </div>

            {toCreate.length > 0 && (
              <div className="max-h-96 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Categoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {toCreate.map((r) => (
                      <TableRow key={r.guardianId}>
                        <TableCell><Badge tone="info">{GUARDIAN_TYPE_LABELS[r.type]}</Badge></TableCell>
                        <TableCell>{r.reporterCollaboratorName}</TableCell>
                        <TableCell className="text-foreground-subtle">{r.occurredAt ? formatDate(r.occurredAt) : "—"}</TableCell>
                        <TableCell className="text-foreground-subtle truncate max-w-xs">{r.categoryName ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {result ? (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="size-4" /> {result.created} relato(s) importado(s) com sucesso.
              </p>
            ) : (
              <Button onClick={handleCommit} loading={committing} disabled={toCreate.length === 0} className="self-start">
                {committing && <Loader2 className="size-4 animate-spin" />}
                Confirmar importação ({toCreate.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
