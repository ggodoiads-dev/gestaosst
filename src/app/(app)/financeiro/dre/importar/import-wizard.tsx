"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { previewDreAction, commitDreAction } from "@/server/actions/dre.actions";
import type { DrePreview } from "@/server/services/dre.service";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ImportWizard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<DrePreview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [committing, startCommit] = useTransition();
  const [done, setDone] = useState<number | null>(null);

  async function handleFile(selected: File) {
    setUploading(true);
    setDone(null);
    const formData = new FormData();
    formData.append("file", selected);
    const res = await previewDreAction(formData);
    setUploading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPreview(res.preview);
    setFile(selected);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleCommit() {
    if (!file) return;
    startCommit(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await commitDreAction(formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDone(res.months);
      toast.success(`DRE importado (${res.months} mês(es)).`);
    });
  }

  const replaced = preview?.months.filter((m) => m.replaces).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Enviar o DRE</CardTitle>
          <CardDescription>O arquivo .xlsx do "Demonstrativo de Resultados" (não o de lançamentos). Exporte de janeiro até o mês atual para vir um mês por coluna.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) void handleFile(selected);
            }}
          />
          <Button variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
            {!uploading && <Upload className="size-4" />}
            Escolher arquivo
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>2. Conferir ({preview.months.length} mês(es) no arquivo)</CardTitle>
            <CardDescription>
              {preview.unit && <>Unidade: {preview.unit}. </>}
              {preview.officialAt && <>Oficial atualizado em {preview.officialAt}. </>}
              {replaced > 0 ? `${replaced} mês(es) já existem no SIGO e serão substituídos pelos valores deste arquivo.` : "Todos os meses são novos."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {preview.warnings.map((w) => (
              <p key={w} className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{w}</p>
            ))}
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Contas</TableHead>
                    <TableHead className="text-right">Receita líquida (realizado)</TableHead>
                    <TableHead className="text-right">EBITDA (realizado)</TableHead>
                    <TableHead className="text-right">EBITDA %</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.months.map((m) => (
                    <TableRow key={m.periodKey}>
                      <TableCell className="font-medium capitalize">{m.label.toLowerCase()}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.lines}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(m.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(m.ebitda)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.ebitdaAvr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</TableCell>
                      <TableCell>{m.replaces ? <Badge tone="warning">substitui</Badge> : <Badge tone="success">novo</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {done !== null ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="size-4" /> {done} mês(es) importado(s) com sucesso.
                </p>
                <Link href="/financeiro/dre" className="text-sm font-medium text-accent hover:underline">Abrir o DRE</Link>
                <Link href="/cascata" className="text-sm font-medium text-accent hover:underline">Ver no Cascateamento</Link>
              </div>
            ) : (
              <Button onClick={handleCommit} loading={committing} className="self-start">
                {committing && <Loader2 className="size-4 animate-spin" />}
                Confirmar importação
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
