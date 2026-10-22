"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Upload, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { importTmaMonthAction } from "@/server/actions/tma.actions";
import { parseTmaSheet, type TmaRowInput } from "@/domain/tma/parse";
import { computeTmaStats, formatDuration } from "@/domain/tma/stats";
import { listTmaMonthSheets, readTmaGrids } from "@/lib/read-tma-workbook";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(0, 4)}`;

type Sheet = { name: string; periodKey: string };
type ReadMonth = { periodKey: string; rows: TmaRowInput[]; warnings: string[]; loaded: number; avg: number | null; ambev: number | null; within3h: number | null };

export function ImportWizard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [months, setMonths] = useState<ReadMonth[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<Record<string, "ok" | "erro" | "enviando">>({});
  const [done, setDone] = useState(false);

  async function handleFile(selected: File) {
    setMonths(null);
    setDone(false);
    setProgress({});
    try {
      const XLSX = await import("xlsx");
      const data = await selected.arrayBuffer();
      const list = listTmaMonthSheets(XLSX, { data, type: "array" });
      if (list.length === 0) {
        toast.error('Não achei abas de mês (como "TMA OUT-26") neste arquivo.');
        return;
      }
      setFile(selected);
      setBuffer(data);
      setSheets(list);
      // Sugestão: os 3 meses mais recentes (o layout padrão da Ambev). Os antigos têm outras colunas.
      setChosen(new Set(list.slice(-3).map((s) => s.name)));
    } catch (error) {
      console.error(error);
      toast.error("Não consegui abrir esse arquivo.");
    }
  }

  async function handleRead() {
    if (!buffer || !sheets) return;
    const names = sheets.filter((s) => chosen.has(s.name)).map((s) => s.name);
    if (names.length === 0) {
      toast.error("Escolha ao menos um mês.");
      return;
    }
    setReading(true);
    // Deixa a tela mostrar "lendo" antes da leitura (que trava o navegador por alguns segundos).
    await new Promise((r) => setTimeout(r, 60));
    try {
      const XLSX = await import("xlsx");
      const grids = readTmaGrids(XLSX, { data: buffer, type: "array" }, names);
      const result: ReadMonth[] = [];
      for (const sheet of sheets.filter((s) => chosen.has(s.name))) {
        const parsed = parseTmaSheet(grids.get(sheet.name) ?? []);
        const stats = computeTmaStats(parsed.rows);
        result.push({ periodKey: sheet.periodKey, rows: parsed.rows, warnings: parsed.warnings, loaded: stats.loaded, avg: stats.avgTma, ambev: stats.atendimento.avg, within3h: stats.within3h });
      }
      setMonths(result);
    } catch (error) {
      console.error(error);
      toast.error("Não consegui ler as abas escolhidas.");
    } finally {
      setReading(false);
    }
  }

  async function handleImport() {
    if (!months || !file) return;
    setImporting(true);
    let failed = false;
    for (const m of months) {
      if (m.rows.length === 0) continue;
      setProgress((p) => ({ ...p, [m.periodKey]: "enviando" }));
      const res = await importTmaMonthAction({ periodKey: m.periodKey, fileName: file.name, rows: m.rows });
      setProgress((p) => ({ ...p, [m.periodKey]: res.ok ? "ok" : "erro" }));
      if (!res.ok) {
        failed = true;
        toast.error(`${monthName(m.periodKey)}: ${res.error}`);
      }
    }
    setImporting(false);
    if (!failed) {
      setDone(true);
      toast.success("Meses importados.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Enviar a planilha</CardTitle>
          <CardDescription>O arquivo .xlsm ou .xlsx do controle de TMA. Ele é lido aqui no seu navegador (tem mais de 5 MB); só os dados dos meses escolhidos são enviados.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsm,.xlsx"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) void handleFile(selected);
            }}
          />
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" /> Escolher arquivo
          </Button>
          {file && <span className="ml-3 text-sm text-foreground-subtle">{file.name}</span>}
        </CardContent>
      </Card>

      {sheets && (
        <Card>
          <CardHeader>
            <CardTitle>2. Escolher os meses</CardTitle>
            <CardDescription>
              Setembro em diante seguem o layout padrão. Os meses antigos têm outras colunas; neles o TMA vem da coluna TMA da planilha. Escolha só o que quer importar agora: a leitura pode levar de alguns segundos a 1 minuto, e a tela fica parada enquanto isso.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {sheets.map((s) => (
                <label key={s.name} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={chosen.has(s.name)}
                    onChange={(e) =>
                      setChosen((cur) => {
                        const next = new Set(cur);
                        if (e.target.checked) next.add(s.name);
                        else next.delete(s.name);
                        return next;
                      })
                    }
                  />
                  {monthName(s.periodKey)}
                </label>
              ))}
            </div>
            <Button onClick={handleRead} loading={reading} className="self-start">
              {reading ? "Lendo a planilha…" : "Ler e conferir"}
            </Button>
          </CardContent>
        </Card>
      )}

      {months && (
        <Card>
          <CardHeader>
            <CardTitle>3. Conferir e importar</CardTitle>
            <CardDescription>TMA = o da planilha da Ambev, só dos caminhões liberados com agendamento. “Tempo de atendimento” é da entrada no atendimento até a liberação (não conta a espera no pátio).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {months.flatMap((m) => m.warnings.map((w) => <p key={m.periodKey + w} className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{monthName(m.periodKey)}: {w}</p>))}
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Linhas</TableHead>
                    <TableHead className="text-right">Liberados</TableHead>
                    <TableHead className="text-right">TMA</TableHead>
                    <TableHead className="text-right">Até 3h</TableHead>
                    <TableHead className="text-right">Tempo de atendimento</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((m) => (
                    <TableRow key={m.periodKey}>
                      <TableCell className="font-medium capitalize">{monthName(m.periodKey)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.rows.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.loaded}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(m.avg)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.within3h === null ? "—" : `${m.within3h.toLocaleString("pt-BR")}%`}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDuration(m.ambev)}</TableCell>
                      <TableCell>
                        {progress[m.periodKey] === "ok" ? <Badge tone="success">importado</Badge> : progress[m.periodKey] === "erro" ? <Badge tone="danger">erro</Badge> : progress[m.periodKey] === "enviando" ? <Badge tone="info">enviando…</Badge> : m.rows.length === 0 ? <Badge tone="warning">sem linhas</Badge> : <Badge tone="neutral">pronto</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {done ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="size-4" /> Importação concluída.
                </p>
                <Link href="/tma" className="text-sm font-medium text-accent hover:underline">Abrir o TMA</Link>
                <Link href="/cascata" className="text-sm font-medium text-accent hover:underline">Ver no Cascateamento</Link>
              </div>
            ) : (
              <Button onClick={handleImport} loading={importing} className="self-start">
                {importing && <Loader2 className="size-4 animate-spin" />}
                Importar {months.filter((m) => m.rows.length > 0).length} mês(es)
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
