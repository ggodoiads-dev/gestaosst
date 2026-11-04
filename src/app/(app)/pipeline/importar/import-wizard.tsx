"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { CRITICALITY, READINESS, POTENTIAL, POSITION_STATUS, iccLabel } from "@/domain/pipeline/rules";
import { readPipelineWorkbookAction, commitPipelineImportAction } from "@/server/actions/pipeline.actions";
import type { PipelineWorkbook } from "@/server/services/pipeline.service";

const label = (list: readonly { key: string; label: string }[], key: string | null | undefined) => list.find((i) => i.key === key)?.label ?? "—";

export function PipelineImportWizard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PipelineWorkbook | null>(null);
  const [replace, setReplace] = useState<"replace" | "append">("replace");
  const [cycleYear, setCycleYear] = useState(String(new Date().getFullYear()));
  const [result, setResult] = useState<{ positionsSaved: number; cyclesSaved: number } | null>(null);

  function read() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione o arquivo.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const res = await readPipelineWorkbookAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData({ positions: res.positions, cycles: res.cycles, notes: res.notes });
    });
  }

  function commit() {
    if (!data) return;
    setError(null);
    startTransition(async () => {
      const res = await commitPipelineImportAction({
        positions: data.positions,
        cycles: data.cycles,
        replacePositions: replace === "replace",
        cycleYear: Number(cycleYear),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({ positionsSaved: res.positionsSaved, cyclesSaved: res.cyclesSaved });
      setData(null);
    });
  }

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success" /> Importação concluída
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground-subtle">
          {result.positionsSaved} cargo(s) no plano de sucessão e {result.cyclesSaved} resultado(s) de Ciclo de Gente.
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/pipeline">Ver o Pipeline</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Enviar a planilha</CardTitle>
          <CardDescription>Arquivo .xlsx com as abas Pipeline e Ciclo de Gente. Só leitura: nada é gravado nesta etapa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input ref={fileInputRef} type="file" accept=".xlsx" className="text-sm" />
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button onClick={read} loading={pending && !data}>
            <Upload className="size-4" /> Enviar e ler
          </Button>
        </CardFooter>
      </Card>

      {data && (
        <>
          {data.notes.length > 0 && (
            <div className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              {data.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>2. Plano de sucessão: {data.positions.length} cargo(s)</CardTitle>
              <CardDescription>
                Confira. Nomes como &quot;fulano&quot; na planilha entram como estão, e dá para editar depois na tela.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {data.positions.length === 0 ? (
                <p className="px-4 py-4 text-sm text-foreground-subtle">Nenhum cargo encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Área</TableHead>
                        <TableHead>Criticidade</TableHead>
                        <TableHead>Ocupante</TableHead>
                        <TableHead>Sucessores</TableHead>
                        <TableHead>Prontidão</TableHead>
                        <TableHead>Potencial</TableHead>
                        <TableHead>Gap</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.positions.map((p) => (
                        <TableRow key={p.row}>
                          <TableCell className="font-medium">{p.cargo}</TableCell>
                          <TableCell className="text-foreground-subtle">{p.area ?? "—"}</TableCell>
                          <TableCell>{label(CRITICALITY, p.criticality)}</TableCell>
                          <TableCell>{p.occupant ?? "—"}</TableCell>
                          <TableCell>{[p.successor1, p.successor2].filter(Boolean).join(" / ") || "—"}</TableCell>
                          <TableCell>{label(READINESS, p.readiness)}</TableCell>
                          <TableCell>{label(POTENTIAL, p.potential)}</TableCell>
                          <TableCell className="text-foreground-subtle">{p.gap ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-foreground-subtle">{p.dueDate ?? p.dueNote ?? "—"}</TableCell>
                          <TableCell className="text-foreground-subtle">{label(POSITION_STATUS, p.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            {data.positions.length > 0 && (
              <CardFooter className="flex-col items-start gap-2">
                <RadioGroup value={replace} onValueChange={(v) => setReplace(v as "replace" | "append")} className="gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="replace" /> Substituir o plano de sucessão atual por este
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value="append" /> Acrescentar estes cargos ao plano atual
                  </label>
                </RadioGroup>
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Ciclo de Gente: {data.cycles.length} resultado(s)</CardTitle>
              <CardDescription>O Ciclo de Gente da planilha vai para o ano abaixo e substitui o que já estiver lançado nesse ano.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.cycles.length === 0 ? (
                <p className="text-sm text-foreground-subtle">A aba não traz resultados (como em &quot;não tivemos ciclo de gente&quot;). Nada será importado daqui.</p>
              ) : (
                <>
                  <label className="flex max-w-40 flex-col gap-1.5 text-[13px] font-medium text-foreground-muted">
                    Ano do ciclo
                    <Input inputMode="numeric" value={cycleYear} onChange={(e) => setCycleYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                  </label>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colaborador</TableHead>
                          <TableHead>Líder</TableHead>
                          <TableHead>Resultado ICC</TableHead>
                          <TableHead>Classificação final</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.cycles.slice(0, 50).map((c) => (
                          <TableRow key={c.row}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-foreground-subtle">{c.leader ?? "—"}</TableCell>
                            <TableCell>{iccLabel(c.iccResult ?? null)}</TableCell>
                            <TableCell className="text-foreground-subtle">{c.finalClass ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {data.cycles.length > 50 && <p className="text-xs text-foreground-subtle">Mostrando 50 de {data.cycles.length}.</p>}
                </>
              )}
            </CardContent>
          </Card>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div>
            <Button onClick={commit} loading={pending} disabled={data.positions.length + data.cycles.length === 0}>
              Confirmar importação
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
