"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import type { MotivosTempo, ParsedSurvey, Satisfacao } from "@/domain/termination/survey";
import { readSurveyFileAction, saveSurveyAction, clearSurveyAction } from "@/server/actions/exit-survey.actions";
import { MotivosTable, SatisfacaoTable } from "./survey-tables";

type Saved = { periodLabel: string | null; updatedAt: string; data: unknown } | null;

const KIND_TITLE = { MOTIVOS_TEMPO: "Motivos da saída por tempo de casa", SATISFACAO: "Satisfação por categoria" } as const;

export function SurveyWizard({ saved }: { saved: { motivos: Saved; satisfacao: Saved } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedSurvey | null>(null);
  const [period, setPeriod] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function handleRead() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo.");
      return;
    }
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const res = await readSurveyFileAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft(res.survey);
      const current = res.survey.kind === "MOTIVOS_TEMPO" ? saved.motivos : saved.satisfacao;
      setPeriod(current?.periodLabel ?? "");
    });
  }

  function handleSave() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const res = await saveSurveyAction(draft, period);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(`${KIND_TITLE[draft.kind]} salvo. Já aparece no PDCA.`);
      setDraft(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    });
  }

  function handleClear(kind: "MOTIVOS_TEMPO" | "SATISFACAO") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await clearSurveyAction(kind);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const savedBlocks = [
    { kind: "MOTIVOS_TEMPO" as const, item: saved.motivos },
    { kind: "SATISFACAO" as const, item: saved.satisfacao },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Enviar tabela</CardTitle>
          <CardDescription>Arquivo .xlsx ou .csv exportado da plataforma, com os títulos na primeira linha. O tipo da tabela é reconhecido sozinho. Enviar de novo o mesmo tipo substitui o anterior.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="text-sm" />
          {error && <p className="text-sm text-danger">{error}</p>}
          {message && <p className="text-sm text-success">{message}</p>}
        </CardContent>
        <CardFooter>
          <Button onClick={handleRead} loading={pending && !draft}>
            <Upload className="size-4" /> Enviar e ler
          </Button>
        </CardFooter>
      </Card>

      {draft && (
        <Card>
          <CardHeader>
            <CardTitle>Confira: {KIND_TITLE[draft.kind]}</CardTitle>
            <CardDescription>Estes são os valores lidos da planilha. Diga a que período eles se referem para ficar registrado no PDCA.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex max-w-md flex-col gap-1.5">
              <label className="text-[13px] font-medium text-foreground-muted">Período (ex.: Jan a Out/2026)</label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} maxLength={80} placeholder="Período a que os números se referem" />
            </div>
            {draft.kind === "MOTIVOS_TEMPO" ? <MotivosTable data={draft.data} /> : <SatisfacaoTable data={draft.data} />}
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={handleSave} loading={pending}>
              Salvar no PDCA
            </Button>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Descartar
            </Button>
          </CardFooter>
        </Card>
      )}

      {savedBlocks.map(({ kind, item }) =>
        item ? (
          <Card key={kind}>
            <CardHeader>
              <div>
                <CardTitle>{KIND_TITLE[kind]}</CardTitle>
                <CardDescription>
                  {item.periodLabel ? `Período: ${item.periodLabel}. ` : "Período não informado. "}Atualizado em {new Date(item.updatedAt).toLocaleDateString("pt-BR")}.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>{kind === "MOTIVOS_TEMPO" ? <MotivosTable data={item.data as MotivosTempo} /> : <SatisfacaoTable data={item.data as Satisfacao} />}</CardContent>
            <CardFooter>
              <Button variant="secondary" onClick={() => handleClear(kind)} loading={pending}>
                <Trash2 className="size-4" /> Remover
              </Button>
            </CardFooter>
          </Card>
        ) : null,
      )}

      <div>
        <Button variant="secondary" asChild>
          <Link href="/desligamentos/pdca">Ver no PDCA</Link>
        </Button>
      </div>
    </div>
  );
}
