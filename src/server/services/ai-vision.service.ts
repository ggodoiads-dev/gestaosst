import "server-only";
import OpenAI from "openai";
import { db } from "@/server/db";
import type { Criticality } from "@/generated/prisma/enums";

const MODEL = "gpt-4o";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

const SEVERITIES: readonly Criticality[] = ["BAIXA", "MEDIA", "ALTA", "CRITICA"];

export type PhotoFinding = {
  severity: Criticality;
  summary: string;
  suggestedAction: string | null;
  model: string;
  rawResponse: string;
};

const FINDING_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "reportar_achado",
    description: "Reporta o achado da análise visual da foto de inspeção de segurança.",
    parameters: {
      type: "object",
      properties: {
        severity: {
          type: "string",
          enum: [...SEVERITIES],
          description: "Severidade do problema identificado na foto para a segurança/operação do equipamento.",
        },
        summary: {
          type: "string",
          description: "Resumo objetivo em 1-2 frases do que foi identificado na foto.",
        },
        suggestedAction: {
          type: "string",
          description: "Sugestão de ação corretiva, quando aplicável.",
        },
      },
      required: ["severity", "summary"],
    },
  },
};

/**
 * Analisa por visão computacional a foto de uma resposta crítica de checklist —
 * "Copiloto de Inspeção". Best-effort por natureza: chave ausente, formato de imagem
 * não suportado, rate limit, timeout ou qualquer erro da API nunca lançam — retornam
 * `null`, e quem chama trata a ausência de achado como algo normal (o checklist
 * nunca pode depender da IA pra funcionar).
 */
export async function analyzePhotoFinding(params: {
  imageBuffer: Buffer;
  mimeType: string;
  questionTitle: string;
  answerComment: string | null;
}): Promise<PhotoFinding | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!SUPPORTED_MEDIA_TYPES.includes(params.mimeType as SupportedMediaType)) return null;

  try {
    const client = new OpenAI({ apiKey });
    const base64 = params.imageBuffer.toString("base64");

    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 500,
      tools: [FINDING_TOOL],
      tool_choice: { type: "function", function: { name: "reportar_achado" } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Você é um especialista em segurança do trabalho analisando uma foto anexada durante uma inspeção de checklist de equipamento.",
                "",
                `Pergunta do checklist: "${params.questionTitle}"`,
                `Comentário do colaborador: "${params.answerComment?.trim() || "(sem comentário)"}"`,
                "",
                "Analise a foto e reporte o que for relevante para segurança ou manutenção — dano, desgaste, condição insegura — ou confirme que está tudo normal. Seja objetivo e específico sobre o que vê na imagem, sem especular além do que é visível.",
              ].join("\n"),
            },
            {
              type: "image_url",
              image_url: { url: `data:${params.mimeType};base64,${base64}` },
            },
          ],
        },
      ],
    });

    const toolCall = response.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") return null;

    const input = JSON.parse(toolCall.function.arguments) as {
      severity?: string;
      summary?: string;
      suggestedAction?: string;
    };
    if (!input.summary || !SEVERITIES.includes(input.severity as Criticality)) return null;

    return {
      severity: input.severity as Criticality,
      summary: input.summary,
      suggestedAction: input.suggestedAction?.trim() || null,
      model: MODEL,
      rawResponse: JSON.stringify(response),
    };
  } catch (error) {
    console.error("[ai-vision] falha na análise da foto:", error);
    return null;
  }
}

/** Persiste o achado, vinculado 1:1 ao anexo que foi analisado. */
export function saveAiInspectionFinding(attachmentId: string, finding: PhotoFinding) {
  return db.aiInspectionFinding.create({
    data: {
      attachmentId,
      severity: finding.severity,
      summary: finding.summary,
      suggestedAction: finding.suggestedAction,
      model: finding.model,
      rawResponse: finding.rawResponse,
    },
  });
}
