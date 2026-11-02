"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateReportAnalysisAction } from "@/server/actions/report.actions";
import type { ReportKind, ReportVersion } from "@/domain/reports/types";

const HEADINGS = ["Leitura geral", "O que preocupa", "O que vai bem", "Hipóteses de causa", "Ações prioritárias"];

/** Quebra o texto da IA em blocos pelos títulos combinados no pedido. */
function blocks(text: string): { title: string | null; lines: string[] }[] {
  const out: { title: string | null; lines: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = HEADINGS.find((h) => line.toLowerCase().replace(/[:.]$/, "") === h.toLowerCase());
    if (heading) out.push({ title: heading, lines: [] });
    else if (out.length === 0) out.push({ title: null, lines: [line] });
    else out[out.length - 1].lines.push(line);
  }
  return out;
}

export function AnalysisPanel({ month, version, kind }: { month: string; version: ReportVersion; kind: ReportKind }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState<string | null>(null);

  function generate() {
    start(async () => {
      const res = await generateReportAnalysisAction(month, version, kind);
      if (res.ok) setText(res.text);
      else toast.error(res.error);
    });
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 print:break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
          <Sparkles className="size-4 text-accent" /> Análise crítica
        </h2>
        <Button size="sm" variant={text ? "secondary" : "primary"} onClick={generate} loading={pending} className="print:hidden">
          {text ? "Gerar de novo" : "Gerar análise com IA"}
        </Button>
      </div>
      {!text && !pending && (
        <p className="text-sm text-foreground-subtle print:hidden">
          O Rico lê os números e os pontos críticos deste relatório e escreve uma leitura crítica, hipóteses e ações prioritárias. Leva alguns segundos. Revise antes de enviar.
        </p>
      )}
      {pending && <p className="text-sm text-foreground-subtle">Analisando os números do mês…</p>}
      {text && (
        <div className="flex flex-col gap-3">
          {blocks(text).map((b, i) => (
            <div key={i}>
              {b.title && <h3 className="text-sm font-semibold text-foreground">{b.title}</h3>}
              {b.lines.map((l, j) => (
                <p key={j} className="text-sm leading-relaxed text-foreground-muted">{l}</p>
              ))}
            </div>
          ))}
          <p className="text-[11px] text-foreground-subtle">Texto gerado por IA apenas com os dados deste relatório. Revise antes de compartilhar.</p>
        </div>
      )}
    </section>
  );
}
