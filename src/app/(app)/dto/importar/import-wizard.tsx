"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { uploadDtoSpreadsheetAction, commitDtoImportAction } from "@/server/actions/dto.actions";
import type { DtoImportRow } from "@/server/services/dto.service";
import { formatDate } from "@/lib/dates";
import { formatPersonName } from "@/lib/format-name";

export function ImportWizard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<DtoImportRow[] | null>(null);
  const [committing, startCommit] = useTransition();
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadDtoSpreadsheetAction(formData);
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
      const res = await commitDtoImportAction(rows);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult({ created: res.created, skipped: res.skipped });
      toast.success(`${res.created} DTO(s) importado(s).`);
    });
  }

  const toCreate = rows?.filter((r) => r.action === "create") ?? [];
  const duplicates = rows?.filter((r) => r.action === "skip-duplicate") ?? [];
  const notInSigo = rows?.filter((r) => r.action === "skip-not-in-sigo") ?? [];
  const ambiguous = rows?.filter((r) => r.action === "skip-ambiguous") ?? [];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Enviar planilha</CardTitle>
          <CardDescription>O arquivo .xlsx do relatório detalhado de DTO exportado do DMPeople.</CardDescription>
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
            <CardTitle>2. Prévia ({rows.length} avaliação(ões) na planilha)</CardTitle>
            <CardDescription>
              Entram só as avaliações de quem está cadastrado como colaborador no SIGO (casado pelo nome) e que ainda não foram
              importadas. O avaliador (liderança) fica gravado como texto, mesmo que não esteja mais no SIGO.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Tile label="Novos — serão importados" value={toCreate.length} tone="text-success" />
              <Tile label="Já importados antes" value={duplicates.length} />
              <Tile label="Avaliado não está no SIGO" value={notInSigo.length} />
              <Tile label="Nome repetido no SIGO" value={ambiguous.length} />
            </div>

            {notInSigo.length > 0 && (
              <p className="text-xs text-foreground-subtle">
                Não entram (não estão no SIGO): {[...new Set(notInSigo.map((r) => formatPersonName(r.evaluatedName)))].join(", ")}.
              </p>
            )}
            {ambiguous.length > 0 && (
              <p className="text-xs text-warning">
                Não entram (mais de um colaborador com esse nome — ajuste o cadastro): {[...new Set(ambiguous.map((r) => formatPersonName(r.evaluatedName)))].join(", ")}.
              </p>
            )}

            {toCreate.length > 0 && (
              <div className="max-h-96 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Avaliado</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Avaliador</TableHead>
                      <TableHead>Conformidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {toCreate.map((r) => (
                      <TableRow key={r.externalKey}>
                        <TableCell>{formatPersonName(r.collaboratorName ?? r.evaluatedName)}</TableCell>
                        <TableCell><Badge tone="info">{r.activity}</Badge></TableCell>
                        <TableCell className="text-foreground-subtle">{formatDate(r.date)}</TableCell>
                        <TableCell className="text-foreground-subtle">{r.evaluatorName ? formatPersonName(r.evaluatorName) : "—"}</TableCell>
                        <TableCell className="tabular-nums">{r.scorePercent === null ? "—" : `${r.scorePercent}%`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {result ? (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="size-4" /> {result.created} DTO(s) importado(s) com sucesso.
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

function Tile({ label, value, tone = "text-foreground-subtle" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2.5">
      <p className="text-xs text-foreground-subtle">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
