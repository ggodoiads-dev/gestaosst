import "server-only";
import OpenAI from "openai";
import type { CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { parseDateOnly } from "@/lib/dates";
import { globalSearch } from "@/server/services/search.service";
import { getGestaoSummary, getTopProblemEquipments } from "@/server/services/indicators.service";
import { getEquipmentRiskRanking } from "@/server/services/risk-score.service";
import { listChecklistBoardForUser } from "@/server/services/checklist-execution.service";
import { listNonconformitiesForUser } from "@/server/services/nonconformity.service";
import { getQualificationDashboard, listQualificationTypes } from "@/server/services/qualification.service";
import { listAccidentsForUser } from "@/server/services/accident.service";
import { listCollaboratorsForUser } from "@/server/services/collaborator.service";
import * as activityService from "@/server/services/activity.service";
import * as qualificationService from "@/server/services/qualification.service";

const MODEL = "gpt-4o";
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT = `Você é o Rico, o assistente de IA do sistema de Gestão de SST e Equipamentos da Log20.
Seu jeito é informal, direto e simpático — um colega de trabalho que conhece o sistema de cor — mas nunca
sacrifica precisão por simpatia.

Regras que você segue sempre:
1. Nunca invente números, status ou nomes de registros. Se a pergunta envolve dado do sistema (contagens,
   status, nomes, prazos), use uma ferramenta de leitura antes de responder. Se a ferramenta não trouxer
   o que precisa, diga que não encontrou — não chute.
2. Você pode propor ações que escrevem no sistema (criar atividade, registrar qualificação), mas nunca
   executa essas ações direto — ao chamar uma ferramenta de escrita, o próprio sistema vai transformar
   isso numa proposta que o usuário precisa confirmar clicando num botão. Avise o usuário que você vai
   deixar isso pronto pra confirmação dele.
3. Se o usuário pedir uma ação de escrita mas faltar informação (ex: registrar qualificação sem saber o
   ID do colaborador), use as ferramentas de leitura pra procurar pelo nome antes de propor a ação.
4. Respostas curtas e objetivas. Você está dentro de um chat, não escrevendo um relatório.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export type PendingAction = {
  tool: "criar_atividade" | "registrar_qualificacao";
  args: Record<string, unknown>;
  label: string;
};

export type RicoTurnResult = { reply: string; pendingAction: PendingAction | null };

const READ_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar",
      description: "Busca livre por equipamento, código, patrimônio, não conformidade etc. no sistema inteiro.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Termo de busca" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resumo_indicadores",
      description: "Resumo geral: % de cumprimento de checklist hoje, NCs abertas/críticas, ações vencidas.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "equipamentos_problematicos",
      description: "Lista os equipamentos com mais não conformidades associadas.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "painel_risco",
      description: "Ranking de equipamentos por score de risco (NCs, achados de IA em fotos, acidentes na área).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "checklist_do_dia",
      description: "Situação dos checklists de hoje (realizado, pendente, atrasado, em andamento) por equipamento.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "nao_conformidades_abertas",
      description: "Lista as não conformidades abertas (não concluídas/encerradas/canceladas).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "qualificacoes_vencendo",
      description: "Qualificações (NR, ASO, integração) com vencimento mais próximo, e quantos colaboradores válidos por tipo.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "acidentes_recentes",
      description: "Lista os acidentes/incidentes/quase-acidentes registrados, mais recentes primeiro.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_colaboradores",
      description: "Lista colaboradores ativos com seus IDs — use antes de propor uma ação que precise identificar um colaborador pelo nome.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tipos_qualificacao",
      description: "Lista os tipos de qualificação (NR, ASO, integração) cadastrados, com seus IDs.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const WRITE_TOOLS: Record<string, { permission: string; tool: OpenAI.Chat.Completions.ChatCompletionTool }> = {
  criar_atividade: {
    permission: PERMISSIONS.ACTIVITY_MANAGE,
    tool: {
      type: "function",
      function: {
        name: "criar_atividade",
        description: "Propõe a criação de uma nova atividade (POP/AR-VR) — precisa de confirmação do usuário.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nome da atividade" },
            code: { type: "string", description: "Código, opcional" },
            description: { type: "string", description: "Descrição, opcional" },
            unit: { type: "string", description: "Unidade de medida pra produtividade (ex: chapas, paletes), opcional" },
          },
          required: ["name"],
        },
      },
    },
  },
  registrar_qualificacao: {
    permission: PERMISSIONS.QUALIFICATION_MANAGE,
    tool: {
      type: "function",
      function: {
        name: "registrar_qualificacao",
        description: "Propõe registrar uma qualificação concluída por um colaborador — precisa de confirmação do usuário.",
        parameters: {
          type: "object",
          properties: {
            collaboratorId: { type: "string", description: "ID do colaborador (use listar_colaboradores antes)" },
            collaboratorName: { type: "string", description: "Nome do colaborador, só para exibição na proposta" },
            qualificationTypeId: { type: "string", description: "ID do tipo de qualificação (use listar_tipos_qualificacao antes)" },
            qualificationTypeName: { type: "string", description: "Nome do tipo, só para exibição na proposta" },
            completedDate: { type: "string", description: "Data de conclusão no formato yyyy-MM-dd" },
            notes: { type: "string", description: "Observações, opcional" },
          },
          required: ["collaboratorId", "collaboratorName", "qualificationTypeId", "qualificationTypeName", "completedDate"],
        },
      },
    },
  },
};

function availableTools(user: CurrentUser): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const writeTools = Object.values(WRITE_TOOLS)
    .filter((w) => user.permissions.has(w.permission))
    .map((w) => w.tool);
  return [...READ_TOOLS, ...writeTools];
}

async function runReadTool(user: CurrentUser, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "buscar":
      return globalSearch(user, String(args.query ?? ""));
    case "resumo_indicadores":
      return getGestaoSummary(user);
    case "equipamentos_problematicos":
      return (await getTopProblemEquipments(user)).map((e) => ({
        codigo: e.equipment.code,
        nome: e.equipment.name,
        quantidadeNC: e.count,
      }));
    case "painel_risco":
      return (await getEquipmentRiskRanking(user)).map((e) => ({
        codigo: e.equipmentCode,
        nome: e.equipmentName,
        area: e.areaName,
        score: e.score,
        achadoIA: e.latestAiFinding?.summary ?? null,
      }));
    case "checklist_do_dia":
      return (await listChecklistBoardForUser(user)).map((b) => ({
        codigo: b.equipment.code,
        nome: b.equipment.name,
        situacao: b.situation,
      }));
    case "nao_conformidades_abertas":
      return (await listNonconformitiesForUser(user, { overdue: false }))
        .filter((nc) => !["CONCLUIDA", "ENCERRADA", "CANCELADA"].includes(nc.status))
        .map((nc) => ({
          codigo: nc.code,
          equipamento: nc.equipment.code,
          severidade: nc.severity,
          status: nc.status,
          descricao: nc.description,
        }));
    case "qualificacoes_vencendo": {
      const dashboard = await getQualificationDashboard(user);
      return {
        colaboradoresAtivos: dashboard.activeCollaboratorsCount,
        proximosVencimentos: dashboard.upcoming.map((r) => ({
          colaborador: r.collaborator.name,
          tipo: r.qualificationType.name,
          vence: r.expiresAt,
        })),
      };
    }
    case "acidentes_recentes":
      return (await listAccidentsForUser(user)).slice(0, 15).map((a) => ({
        codigo: a.code,
        data: a.date,
        tipo: a.type,
        severidade: a.severity,
        status: a.status,
        descricao: a.description,
      }));
    case "listar_colaboradores":
      return (await listCollaboratorsForUser(user, { onlyActive: true })).map((c) => ({
        id: c.id,
        nome: c.name,
        cargo: c.cargo,
      }));
    case "listar_tipos_qualificacao":
      return (await listQualificationTypes(user, { onlyActive: true })).map((t) => ({
        id: t.id,
        nome: t.name,
        categoria: t.category,
      }));
    default:
      return { erro: "ferramenta desconhecida" };
  }
}

function proposeWriteAction(name: string, args: Record<string, unknown>): PendingAction {
  if (name === "criar_atividade") {
    return { tool: "criar_atividade", args, label: `Criar atividade "${args.name}"` };
  }
  return {
    tool: "registrar_qualificacao",
    args,
    label: `Registrar "${args.qualificationTypeName}" para ${args.collaboratorName}`,
  };
}

/**
 * Executa um turno de conversa com o Rico. Ferramentas de leitura são executadas
 * direto (sem risco, são só consultas); se o modelo pedir uma ferramenta de escrita,
 * o loop para e devolve uma `pendingAction` — nada é escrito no banco até o usuário
 * confirmar explicitamente (ver `executeRicoAction`).
 */
export async function runRicoTurn(
  user: CurrentUser,
  history: ChatMessage[],
  message: string,
): Promise<RicoTurnResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      reply: "Ainda não tenho uma chave de IA configurada (OPENAI_API_KEY) — peço pro administrador configurar.",
      pendingAction: null,
    };
  }

  const client = new OpenAI({ apiKey });
  const tools = availableTools(user);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nUsuário atual: ${user.name} (${user.roleName}).` },
    ...history.map((h) => ({ role: h.role, content: h.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
    { role: "user", content: message },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.chat.completions.create({ model: MODEL, messages, tools });
    const choice = response.choices[0]?.message;
    if (!choice) return { reply: "Não consegui responder agora, tenta de novo.", pendingAction: null };

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { reply: choice.content ?? "...", pendingAction: null };
    }

    const writeCall = toolCalls.find((c) => c.type === "function" && c.function.name in WRITE_TOOLS);
    if (writeCall && writeCall.type === "function") {
      const args = JSON.parse(writeCall.function.arguments) as Record<string, unknown>;
      const reply =
        choice.content?.trim() ||
        "Deixei essa ação pronta pra você confirmar aqui embaixo antes de eu criar de verdade.";
      return { reply, pendingAction: proposeWriteAction(writeCall.function.name, args) };
    }

    messages.push(choice);
    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
      const result = await runReadTool(user, call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return { reply: "Isso ficou complexo demais pra eu resolver em uma resposta — pode tentar de um jeito mais direto?", pendingAction: null };
}

/** Executa de verdade uma ação de escrita já confirmada pelo usuário no chat. */
export async function executeRicoAction(
  user: CurrentUser,
  tool: PendingAction["tool"],
  args: Record<string, unknown>,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const definition = WRITE_TOOLS[tool];
  if (!definition || !user.permissions.has(definition.permission)) {
    return { ok: false, error: "Você não tem permissão para essa ação." };
  }

  try {
    if (tool === "criar_atividade") {
      const activity = await activityService.createActivity(user, {
        name: String(args.name ?? ""),
        code: args.code ? String(args.code) : null,
        description: args.description ? String(args.description) : null,
        unit: args.unit ? String(args.unit) : null,
      });
      return { ok: true, message: `Atividade "${activity.name}" criada.` };
    }

    if (tool === "registrar_qualificacao") {
      await qualificationService.createQualificationRecord(user, {
        collaboratorId: String(args.collaboratorId ?? ""),
        qualificationTypeId: String(args.qualificationTypeId ?? ""),
        completedDate: parseDateOnly(String(args.completedDate ?? "")),
        notes: args.notes ? String(args.notes) : null,
      });
      return { ok: true, message: `Qualificação registrada para ${args.collaboratorName}.` };
    }

    return { ok: false, error: "Ação desconhecida." };
  } catch (error) {
    console.error("[rico] falha ao executar ação confirmada:", error);
    return { ok: false, error: "Não foi possível concluir a ação." };
  }
}
