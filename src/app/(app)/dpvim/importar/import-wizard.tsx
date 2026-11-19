"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Upload, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { previewDpvimImportAction, commitDpvimImportAction } from "@/server/actions/dpvim-import.actions";
import type { DpvimImportRow } from "@/server/services/dpvim-import.service";

type Step = "upload" | "review" | "done";

const fmtDay = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

/** Importa as DPVIM em aberto da planilha "NF (Pendente VIM)": envia, confere o que vai ser criado e confirma. */
export function DpvimImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DpvimImportRow[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: number; failed: string[] } | null>(null);

  const toCreate = rows.filter((r) => r.status === "create");
  const exists = rows.filter((r) => r.status === "exists").length;
  const withErrors = rows.filter((r) => r.status === "error").length;
  const newSuppliers = [...new Set(toCreate.filter((r) => r.supplierIsNew).map((r) => r.supplierLabel))];

  function body(): FormData | null {
    if (!file) return null;
    const fd = new FormData();
    fd.append("file", file);
    return fd;
  }

  function preview() {
    const picked = inputRef.current?.files?.[0] ?? null;
    if (!picked) {
      setError("Selecione um arquivo.");
      return;
    }
    setFile(picked);
    setError(null);
    const fd = new FormData();
    fd.append("file", picked);
    start(async () => {
      const res = await previewDpvimImportAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows(res.rows);
      setStep("review");
    });
  }

  function commit() {
    const fd = body();
    if (!fd) return;
    setError(null);
    start(async () => {
      const res = await commitDpvimImportAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ created: res.created, skipped: res.skipped, errors: res.errors, failed: res.failed });
      setStep("done");
    });
  }

  return (
    <Card>
      {step === "upload" && (
        <>
          <CardHeader>
            <CardTitle>1. Enviar a planilha</CardTitle>
            <CardDescription>
              A planilha &ldquo;NF (Pendente VIM)&rdquo;, formatos .xlsx ou .csv, com as colunas VIM, NF, Empresa/fornecedor, Material, Quantidade e Data. Só a primeira aba é lida. Cada VIM vira uma DPVIM.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="text-sm" />
            {error && <p className="text-sm text-danger">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button onClick={preview} loading={pending}>
              <Upload className="size-4" /> Enviar e conferir
            </Button>
          </CardFooter>
        </>
      )}

      {step === "review" && (
        <>
          <CardHeader>
            <CardTitle>2. Conferir antes de importar</CardTitle>
            <CardDescription>Nada foi gravado ainda. Veja o que vai ser criado; as VIM que já foram importadas ficam de fora, e as com erro precisam ser corrigidas na planilha.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="success">{toCreate.length} DPVIM para criar</Badge>
              {exists > 0 && <Badge tone="neutral">{exists} já importadas (puladas)</Badge>}
              {withErrors > 0 && <Badge tone="danger">{withErrors} com erro</Badge>}
            </div>
            {newSuppliers.length > 0 && (
              <p className="rounded-md border border-warning/40 bg-warning-soft/40 px-3 py-2 text-xs text-foreground">
                Fornecedores novos que serão cadastrados (nome · unidade): <strong>{newSuppliers.join(", ")}</strong>.
              </p>
            )}
            <p className="text-xs text-foreground-subtle">
              A quantidade da planilha é a da <strong>nota</strong>: ela fica só para quem vê a nota. A contagem de quem recebe a carga (o &ldquo;norte&rdquo;) fica vazia, e a chegada é o dia da planilha, à meia-noite.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-muted text-left text-xs text-foreground-subtle">
                    <th className="px-3 py-2 font-semibold">VIM</th>
                    <th className="px-3 py-2 font-semibold">Fornecedor</th>
                    <th className="px-3 py-2 font-semibold">Chegada</th>
                    <th className="px-3 py-2 font-semibold">Produtos (nota)</th>
                    <th className="px-3 py-2 font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.vim} className="border-t border-border align-top">
                      <td className="px-3 py-2">
                        <span className="font-semibold text-foreground">{r.vim}</span>
                        {r.nfs.length > 0 && <p className="text-[11px] text-foreground-subtle">NF {r.nfs.join(", ")}</p>}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {r.supplierLabel || "—"}
                        {r.supplierIsNew && <span className="ml-1 text-[11px] text-warning">(novo)</span>}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-foreground-subtle">{fmtDay(r.arrivedDay)}</td>
                      <td className="px-3 py-2 text-xs text-foreground">{r.items.map((i) => `${i.label} ${i.qty.toLocaleString("pt-BR")}`).join(" · ") || "—"}</td>
                      <td className="px-3 py-2">
                        {r.status === "create" && <Badge tone="success">Criar</Badge>}
                        {r.status === "exists" && <Badge tone="neutral">{r.message}</Badge>}
                        {r.status === "error" && (
                          <div className="flex flex-col gap-0.5">
                            <Badge tone="danger">Erro</Badge>
                            <span className="text-[11px] text-danger">{r.message}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep("upload")} disabled={pending}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
            <Button onClick={commit} loading={pending} disabled={toCreate.length === 0}>
              Importar {toCreate.length} DPVIM
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
          <CardContent className="flex flex-col gap-2 text-sm text-foreground">
            <p>
              <strong>{result.created}</strong> DPVIM criadas.
              {result.skipped > 0 && ` ${result.skipped} já existiam e foram puladas.`}
              {result.errors > 0 && ` ${result.errors} com erro na planilha ficaram de fora.`}
            </p>
            {result.failed.length > 0 && <p className="text-danger">Não consegui criar a(s) VIM: {result.failed.join(", ")}. Tente importar de novo (as já criadas não duplicam).</p>}
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/dpvim">Ver as DPVIM</Link>
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
