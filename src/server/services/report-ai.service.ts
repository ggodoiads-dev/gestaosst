import "server-only";
import OpenAI from "openai";
import type { MonthlyReport } from "@/domain/reports/types";

const MODEL = "gpt-4o";

/** Resume o relatório em dados puros: é só isso que a IA recebe (nada além do que está na tela). */
function factsOf(report: MonthlyReport) {
  return {
    relatorio: report.title ?? "Relatório mensal de segurança e operação",
    mes: report.monthLabel,
    versao: report.version === "cliente" ? "cliente (Ambev)" : "interna (gestão)",
    indicadores_executivos: report.executive.map((k) => ({ indicador: k.label, valor: k.value, comparacao: k.delta ?? null, nota: k.note ?? null })),
    pontos_criticos: report.findings.map((f) => ({ gravidade: f.severity, modulo: f.module, titulo: f.title, detalhe: f.detail })),
    modulos: report.sections.map((s) => ({
      modulo: s.title,
      escopo: s.scope,
      indicadores: s.kpis.map((k) => ({ indicador: k.label, valor: k.value, comparacao: k.delta ?? null, nota: k.note ?? null })),
      series: s.series.map((x) => ({ titulo: x.title, pontos: x.points.map((p) => `${p.label}: ${p.value}`) })),
      tabelas: s.tables.map((t) => ({ titulo: t.title, colunas: t.columns, linhas: t.rows.slice(0, 8) })),
      observacoes: s.notes,
    })),
    modulos_indisponiveis: report.unavailable,
  };
}

const SYSTEM = `Você é analista sênior de segurança do trabalho e de operações logísticas da LOG20 (operação dentro de uma cervejaria), escrevendo a análise crítica de um relatório mensal do sistema SIGO.

REGRAS INEGOCIÁVEIS
- Use SOMENTE os números e fatos recebidos. Nunca invente valor, nome, data ou ocorrência. Se um dado não estiver nos fatos, diga que não há dado.
- Causas são hipóteses: escreva "Hipótese:" antes de qualquer explicação que não esteja nos fatos.
- Seja crítico e específico: aponte o que está pior do que deveria, compare com o mês anterior quando houver comparação, e priorize pelo risco (vida e segurança primeiro, depois conformidade, depois produtividade).
- Não elogie por elogiar. Só destaque o que vai bem se isso mudar uma decisão.
- Não repita todos os números: escolha os que sustentam cada conclusão.

FORMATO (texto simples, sem markdown, sem asteriscos; cada bloco começa com o título numa linha sozinha):
Leitura geral
O que preocupa
O que vai bem
Hipóteses de causa
Ações prioritárias

"Ações prioritárias": no máximo 6, em linhas numeradas "1. ação — responsável sugerido (função) — prazo". Entre 350 e 500 palavras no total. Português do Brasil, tom direto e profissional.`;

const SYSTEM_CLIENTE = `\n\nESTA É A VERSÃO PARA O CLIENTE: linguagem institucional, sem citar nomes de pessoas, sem dados internos de RH ou de gestão de pessoas; foque em controles, conformidade, resultados e no que está sendo feito.`;

export async function generateReportAnalysis(report: MonthlyReport): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM + (report.version === "cliente" ? SYSTEM_CLIENTE : "") },
        { role: "user", content: `Dados do relatório (JSON):\n${JSON.stringify(factsOf(report))}` },
      ],
    });
    return response.choices[0]?.message.content?.trim() || null;
  } catch (error) {
    console.error("[relatorio] falha ao gerar a análise:", error);
    return null;
  }
}
