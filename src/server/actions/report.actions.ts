"use server";

import { requireUser, ForbiddenError } from "@/server/auth/current-user";
import { buildMonthlyReport } from "@/server/services/report.service";
import { generateReportAnalysis } from "@/server/services/report-ai.service";
import type { ReportVersion } from "@/domain/reports/types";

export type AnalysisResult = { ok: true; text: string } | { ok: false; error: string };

/** Gera o texto de análise (IA) a partir dos números do relatório — recalculados aqui, no servidor, nunca recebidos do navegador. */
export async function generateReportAnalysisAction(month: string, version: ReportVersion): Promise<AnalysisResult> {
  try {
    const user = await requireUser();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || (version !== "interno" && version !== "cliente")) return { ok: false, error: "Pedido inválido." };
    const report = await buildMonthlyReport(user, month, version);
    const text = await generateReportAnalysis(report);
    if (!text) return { ok: false, error: process.env.OPENAI_API_KEY ? "Não consegui gerar a análise agora. Tente de novo em instantes." : "A chave da IA (OPENAI_API_KEY) não está configurada." };
    return { ok: true, text };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: "Você não tem acesso aos relatórios." };
    console.error("[relatorio] análise falhou:", error);
    return { ok: false, error: "Não foi possível gerar a análise." };
  }
}
