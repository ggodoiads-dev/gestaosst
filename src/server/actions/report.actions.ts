"use server";

import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { buildMonthlyReport } from "@/server/services/report.service";
import { buildDetailedReport, REPORT_KINDS } from "@/server/services/report-detail.service";
import { generateReportAnalysis, generateAbntText, type AbntAiText } from "@/server/services/report-ai.service";
import type { ReportKind, ReportVersion } from "@/domain/reports/types";

export type AnalysisResult = { ok: true; text: string } | { ok: false; error: string };

/** Gera o texto de análise (IA) a partir dos números do relatório — recalculados aqui, no servidor, nunca recebidos do navegador. */
export async function generateReportAnalysisAction(month: string, version: ReportVersion, kind: ReportKind = "consolidado"): Promise<AnalysisResult> {
  try {
    const user = await requireUser();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || (version !== "interno" && version !== "cliente")) return { ok: false, error: "Pedido inválido." };
    if (!REPORT_KINDS.some((k) => k.key === kind)) return { ok: false, error: "Pedido inválido." };
    const report = kind === "consolidado" ? await buildMonthlyReport(user, month, version) : await buildDetailedReport(user, kind, month, version);
    const text = await generateReportAnalysis(report);
    if (!text) return { ok: false, error: process.env.OPENAI_API_KEY ? "Não consegui gerar a análise agora. Tente de novo em instantes." : "A chave da IA (OPENAI_API_KEY) não está configurada." };
    return { ok: true, text };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: "Você não tem acesso aos relatórios." };
    console.error("[relatorio] análise falhou:", error);
    return { ok: false, error: "Não foi possível gerar a análise." };
  }
}

export type AbntTextResult = { ok: true; text: AbntAiText } | { ok: false; error: string };

/** Discussão, conclusões e recomendações do relatório técnico (ABNT), em texto corrido, escritas pela IA sobre os números do relatório. */
export async function generateAbntTextAction(month: string, version: ReportVersion, kind: ReportKind = "consolidado"): Promise<AbntTextResult> {
  try {
    const user = await requireUser();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || (version !== "interno" && version !== "cliente")) return { ok: false, error: "Pedido inválido." };
    if (!REPORT_KINDS.some((k) => k.key === kind)) return { ok: false, error: "Pedido inválido." };
    const report = kind === "consolidado" ? await buildMonthlyReport(user, month, version) : await buildDetailedReport(user, kind, month, version);
    const text = await generateAbntText(report);
    if (!text) return { ok: false, error: process.env.OPENAI_API_KEY ? "Não consegui gerar o texto agora. Tente de novo em instantes." : "A chave da IA (OPENAI_API_KEY) não está configurada." };
    return { ok: true, text };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: "Você não tem acesso aos relatórios." };
    console.error("[relatorio] texto ABNT falhou:", error);
    return { ok: false, error: "Não foi possível gerar o texto." };
  }
}
