"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateAbntTextAction } from "@/server/actions/report.actions";
import { buildAbntContent, type AbntBlock, type AbntText } from "@/domain/reports/narrative";
import type { MonthlyReport, ReportKind, ReportVersion } from "@/domain/reports/types";
import { SeriesBars } from "./report-charts";

function Block({ b }: { b: AbntBlock }) {
  if (b.type === "p") return <p>{b.text}</p>;
  if (b.type === "list") {
    return (
      <ul className="abnt-list">
        {b.items.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    );
  }
  if (b.type === "table") {
    const right = new Set(b.table.rightAlign ?? []);
    return (
      <div className="break-inside-avoid">
        <p className="abnt-caption">Tabela {b.n} – {b.table.title}</p>
        <table className="abnt-table">
          <thead>
            <tr>
              {b.table.columns.map((c, i) => (
                <th key={c} style={{ textAlign: right.has(i) ? "right" : "left" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ textAlign: right.has(ci) ? "right" : "left" }}>{cell}</td>
                ))}
              </tr>
            ))}
            {b.table.rows.length === 0 && (
              <tr>
                <td colSpan={b.table.columns.length}>Sem registros no período.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="abnt-source">Fonte: {b.source}</p>
      </div>
    );
  }
  return (
    <div className="break-inside-avoid">
      <p className="abnt-caption">Figura {b.n} – {b.series.title}</p>
      <SeriesBars series={{ ...b.series, title: "" }} />
      <p className="abnt-source">Fonte: {b.source}</p>
    </div>
  );
}

export function AbntReport({ report, month, version, kind }: { report: MonthlyReport; month: string; version: ReportVersion; kind: ReportKind }) {
  const [ai, setAi] = useState<AbntText | null>(null);
  const [pending, start] = useTransition();
  const content = buildAbntContent(report, ai);
  const title = report.title ?? "Relatório mensal de segurança e operação";
  const year = month.slice(0, 4);
  const issued = new Date(report.generatedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });

  function generate() {
    start(async () => {
      const res = await generateAbntTextAction(month, version, kind);
      if (res.ok) setAi(res.text);
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 print:hidden">
        <p className="max-w-xl text-sm text-foreground-muted">
          Texto corrido no formato de relatório técnico (ABNT NBR 10719): introdução, objetivos, metodologia, resultados, discussão, conclusões e recomendações. A discussão e as conclusões por IA são opcionais e entram marcadas como tal.
        </p>
        <Button size="sm" variant={ai ? "secondary" : "primary"} onClick={generate} loading={pending}>
          <Sparkles className="size-4" /> {ai ? "Gerar a discussão de novo" : "Gerar discussão e conclusões com IA"}
        </Button>
      </div>

      <article className="abnt-doc">
        {/* Capa */}
        <section className="abnt-page" style={{ minHeight: "22cm", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "center" }}>
          <p style={{ textIndent: 0, textAlign: "center", fontWeight: 700, textTransform: "uppercase" }}>LOG20 Logística</p>
          <div>
            <p style={{ textIndent: 0, textAlign: "center", fontWeight: 700, textTransform: "uppercase", fontSize: "14pt" }}>{title}</p>
            <p style={{ textIndent: 0, textAlign: "center", marginTop: "0.5em" }}>{report.monthLabel}</p>
          </div>
          <p style={{ textIndent: 0, textAlign: "center" }}>{year}</p>
        </section>

        {/* Folha de rosto */}
        <section className="abnt-page" style={{ minHeight: "22cm", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "center" }}>
          <div>
            <p style={{ textIndent: 0, textAlign: "center", fontWeight: 700, textTransform: "uppercase" }}>LOG20 Logística</p>
            <p style={{ textIndent: 0, textAlign: "center", marginTop: "0.5em" }}>{report.generatedBy}</p>
          </div>
          <div>
            <p style={{ textIndent: 0, textAlign: "center", fontWeight: 700, textTransform: "uppercase" }}>{title}</p>
            <p style={{ textIndent: 0, textAlign: "center" }}>{report.monthLabel}</p>
            <p style={{ textIndent: "8cm", textAlign: "justify", marginTop: "1.5em", fontSize: "10pt", lineHeight: 1.2 }}>
              Relatório técnico emitido pelo SIGO (Sistema Interno de Gestão Organizacional), {report.version === "cliente" ? "versão destinada ao cliente" : "versão destinada à gestão interna"}.
            </p>
          </div>
          <p style={{ textIndent: 0, textAlign: "center" }}>Emitido em {issued}</p>
        </section>

        {/* Resumo */}
        <section className="abnt-page">
          <p style={{ textIndent: 0, textAlign: "center", fontWeight: 700, textTransform: "uppercase" }}>Resumo</p>
          <p style={{ textIndent: 0, lineHeight: 1.2, marginTop: "1em" }}>{content.resumo}</p>
          <p style={{ textIndent: 0, marginTop: "1em" }}>
            <strong>Palavras-chave:</strong> {content.keywords.join("; ")}.
          </p>
        </section>

        {/* Sumário */}
        <section className="abnt-page">
          <p style={{ textIndent: 0, textAlign: "center", fontWeight: 700, textTransform: "uppercase" }}>Sumário</p>
          <ul style={{ listStyle: "none", margin: "1em 0 0", padding: 0 }}>
            {content.sections.map((s) => (
              <li key={s.number} style={{ paddingLeft: s.level === 2 ? "1cm" : 0, fontWeight: s.level === 1 ? 700 : 400 }}>
                {s.number} {s.level === 1 ? s.title : s.title}
              </li>
            ))}
            <li style={{ fontWeight: 700 }}>REFERÊNCIAS</li>
          </ul>
        </section>

        {/* Corpo */}
        {content.sections.map((s) => (
          <section key={s.number}>
            {s.level === 1 ? (
              <h2 className="abnt-h1">{s.number} {s.title}</h2>
            ) : (
              <h3 className="abnt-h2">{s.number} {s.title}</h3>
            )}
            {s.blocks.map((b, i) => (
              <Block key={i} b={b} />
            ))}
          </section>
        ))}

        <section>
          <h2 className="abnt-h1" style={{ textAlign: "center" }}>Referências</h2>
          {content.references.map((r) => (
            <p key={r} style={{ textIndent: 0, textAlign: "left", lineHeight: 1.2, marginBottom: "1em" }}>{r}</p>
          ))}
        </section>
      </article>
    </div>
  );
}
