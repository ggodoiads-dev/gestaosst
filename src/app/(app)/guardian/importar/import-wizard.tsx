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
  const [file, setFile] = useState<File | null>(null);
  const [committing, startCommit] = useTransition();
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

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
    setFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleCommit() {
    if (!rows || !file) return;
    startCommit(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await commitGuardianImportAction(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult({ created: res.created, updated: res.updated, skipped: res.skipped });
      toast.success(`${res.created} relato(s) importado(s)${res.updated > 0 ? `, ${res.updated} reatribuído(s)` : ""}.`);
    });
  }

  const toCreate = rows?.filter((r) => r.action === "create") ?? [];
  const duplicates = rows?.filter((r) => r.action === "skip-duplicate") ?? [];
  const reassigned = rows?.filter((r) => r.action === "update-reporter") ?? [];
  const notLog20 = rows?.filter((r) => r.action === "skip-not-log20") ?? [];
  const ambiguous = rows?.filter((r) => r.action === "skip-ambiguous") ?? [];
  // Nomes que não casaram (com quantos relatos cada) — pra conferir se alguém da LOG20 ficou de fora por nome diferente.
  const countByName = (list: GuardianImportRow[]) => {
    const map = new Map<string, number>();
    for (const r of list) map.set(r.reporterName ?? "(sem nome)", (map.get(r.reporterName ?? "(sem nome)") ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  };
  const notLog20Names = countByName(notLog20);

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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 text-sm">
              <div className="rounded-md border border-border px-3 py-2.5">
                <p className="text-xs text-foreground-subtle">Novos — serão importados</p>
                <p className="text-lg font-semibold text-success tabular-nums">{toCreate.length}</p>
              </div>
              <div className="rounded-md border border-border px-3 py-2.5">
                <p className="text-xs text-foreground-subtle">Crédito corrigido (observado por outra pessoa)</p>
                <p className="text-lg font-semibold text-warning tabular-nums">{reassigned.length}</p>
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

            {ambiguous.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2.5 text-sm">
                <p className="font-medium text-warning">Nome serve para mais de uma pessoa — não foi creditado a ninguém ({ambiguous.length} relato(s))</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-xs text-foreground">
                  {[...new Map(ambiguous.map((r) => [r.reporterName, r.ambiguousWith])).entries()].map(([name, withWho]) => (
                    <li key={name}>
                      <strong>{name}</strong> pode ser: {(withWho ?? []).join(" · ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-foreground-subtle">Para resolver, deixe o nome de cada colaborador mais distinto no cadastro ou peça o relato com CPF/ID.</p>
              </div>
            )}

            {notLog20Names.length > 0 && (
              <details className="rounded-md border border-border px-3 py-2 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-foreground-subtle">
                  Quem ficou de fora por não ser da LOG20 ({notLog20Names.length} nome(s)) — confira se não é alguém nosso com o nome escrito diferente
                </summary>
                <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
                  {notLog20Names.map(([name, count]) => (
                    <li key={name} className="flex justify-between gap-2">
                      <span>{name}</span>
                      <span className="tabular-nums text-foreground-subtle">{count}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

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
                <CheckCircle2 className="size-4" /> {result.created} relato(s) importado(s) com sucesso{result.updated > 0 ? ` e ${result.updated} com o crédito corrigido` : ""}.
              </p>
            ) : (
              <Button onClick={handleCommit} loading={committing} disabled={toCreate.length === 0 && reassigned.length === 0} className="self-start">
                {committing && <Loader2 className="size-4 animate-spin" />}
                Confirmar importação ({toCreate.length + reassigned.length})
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
