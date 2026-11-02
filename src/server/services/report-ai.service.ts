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

const SYSTEM_ABNT = `Você redige trechos de um relatório técnico (ABNT NBR 10719) sobre segurança e operação logística da LOG20, a partir de dados do sistema SIGO.

REGRAS INEGOCIÁVEIS
- Use SOMENTE os números e fatos recebidos. Nunca invente valor, nome, data ou ocorrência.
- Linguagem formal, impessoal, em terceira pessoa ("observou-se", "verificou-se", "recomenda-se"). Texto corrido em parágrafos completos; sem listas, sem markdown, sem asteriscos.
- Causas não comprovadas pelos dados devem ser apresentadas como hipótese ("pode-se supor", "hipotetiza-se", "é possível que"), nunca como fato.
- Seja crítico e específico: aponte o que está pior do que deveria, compare com o mês anterior quando houver comparação e priorize pelo risco (vida e segurança, depois conformidade, depois produtividade).

Responda APENAS com um objeto JSON com exatamente estas chaves:
{"discussao": [3 a 4 parágrafos], "conclusoes": [2 parágrafos], "recomendacoes": [4 a 6 frases completas, cada uma indicando a ação, o responsável sugerido por função e o prazo]}`;

export type AbntAiText = { discussao: string[]; conclusoes: string[]; recomendacoes: string[] };

/** Discussão, conclusões e recomendações do relatório técnico, em prosa formal. Devolve `null` sem chave de IA ou se a resposta não vier no formato pedido. */
export async function generateAbntText(report: MonthlyReport): Promise<AbntAiText | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1800,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_ABNT + (report.version === "cliente" ? SYSTEM_CLIENTE : "") },
        { role: "user", content: `Dados do relatório (JSON):\n${JSON.stringify(factsOf(report))}` },
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message.content ?? "{}") as Partial<AbntAiText>;
    const clean = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : []);
    const out = { discussao: clean(parsed.discussao), conclusoes: clean(parsed.conclusoes), recomendacoes: clean(parsed.recomendacoes) };
    return out.discussao.length + out.conclusoes.length + out.recomendacoes.length > 0 ? out : null;
  } catch (error) {
    console.error("[relatorio] falha ao gerar o texto ABNT:", error);
    return null;
  }
}
