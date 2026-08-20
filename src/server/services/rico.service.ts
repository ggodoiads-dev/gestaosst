import "server-only";
import OpenAI from "openai";
import type { CurrentUser } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { parseDateOnly } from "@/lib/dates";
import type { NonconformityStatus, EpiDeliveryReason } from "@/generated/prisma/enums";
import { globalSearch } from "@/server/services/search.service";
import { getGestaoSummary, getTopProblemEquipments } from "@/server/services/indicators.service";
import { getEquipmentRiskRanking } from "@/server/services/risk-score.service";
import { listChecklistBoardForUser } from "@/server/services/checklist-execution.service";
import { listNonconformitiesForUser, setNonconformityStatus } from "@/server/services/nonconformity.service";
import { getQualificationDashboard, listQualificationTypes } from "@/server/services/qualification.service";
import { listAccidentsForUser } from "@/server/services/accident.service";
import { listCollaboratorsForUser } from "@/server/services/collaborator.service";
import { listAreas } from "@/server/services/masterdata.service";
import * as activityService from "@/server/services/activity.service";
import * as qualificationService from "@/server/services/qualification.service";
import * as collaboratorService from "@/server/services/collaborator.service";
import * as epiService from "@/server/services/epi.service";

const NC_STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  ACAO_DEFINIDA: "Ação definida",
  EM_EXECUCAO: "Em execução",
  AGUARDANDO_VERIFICACAO: "Aguardando verificação",
  CONCLUIDA: "Concluída",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
};

const MODEL = "gpt-4o";
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT = `Você é o Rico, o assistente de IA do SIGO — Sistema Interno de Gestão Organizacional.
Seu jeito é informal, direto e simpático — um colega de trabalho que conhece o sistema de cor — mas nunca
sacrifica precisão por simpatia.

Regras que você segue sempre:
1. Nunca invente números, status ou nomes de registros. Se a pergunta envolve dado do sistema (contagens,
   status, nomes, prazos), use uma ferramenta de leitura antes de responder. Se a ferramenta não trouxer
   o que precisa, diga que não encontrou — não chute. Essa cautela é só pra dados do SIGO e pra dados em
   tempo real que você genuinamente não tem acesso (ex: previsão do tempo real — você pode dizer que não
   tem acesso a isso, mas nunca invente uma previsão). Ela NÃO se aplica a pedidos de conteúdo/redação
   (DDS, dicas de segurança, procedimentos, explicações gerais) — mesmo que o tema toque em algo que você
   não tem dado ao vivo (ex: um DDS sobre riscos do tempo/clima), escreva o conteúdo normalmente, de forma
   genérica, sem fingir que sabe a previsão de hoje.
2. Você pode propor ações que escrevem no sistema (criar atividade, registrar qualificação, cadastrar
   colaborador, mudar status de não conformidade, registrar entrega de EPI), mas nunca executa essas
   ações direto — ao chamar uma ferramenta de escrita, o próprio sistema vai transformar isso numa
   proposta que o usuário precisa confirmar clicando num botão. Avise o usuário que você vai deixar isso
   pronto pra confirmação dele. Se o usuário pedir uma ação de escrita que você não tem ferramenta pra
   fazer, diga claramente que ainda não sabe fazer isso — não finja que executou.
3. Se o usuário pedir uma ação de escrita mas faltar informação (ex: registrar qualificação sem saber o
   ID do colaborador), use as ferramentas de leitura pra procurar pelo nome antes de propor a ação. Os
   IDs que essas ferramentas retornam são só pra você usar internamente ao chamar a próxima ferramenta —
   nunca mostre um ID (UUID) pro usuário na conversa; refira-se aos registros pelo nome, código ou
   descrição. Se restar ambiguidade (duas opções com nome parecido), pergunte usando os nomes, não os IDs.
4. Respostas curtas e objetivas. Você está dentro de um chat, não escrevendo um relatório.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export type PendingAction = {
  tool:
    | "criar_atividade"
    | "registrar_qualificacao"
    | "criar_colaborador"
    | "atualizar_status_nao_conformidade"
    | "criar_entrega_epi";
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
  {
    type: "function",
    function: {
      name: "listar_funcoes",
      description: "Lista as funções (cargos) cadastradas com seus IDs — use antes de cadastrar um colaborador com função definida.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_areas",
      description: "Lista as áreas cadastradas com seus IDs — use antes de cadastrar um colaborador com área definida.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tipos_epi",
      description: "Lista os tipos de EPI cadastrados com seus IDs — use antes de registrar uma entrega de EPI.",
      parameters: { type: "object", properties: {} },
    },
  },
];

type RicoActionResult = { ok: true; message: string } | { ok: false; error: string };

type WriteToolDefinition = {
  permission: string;
  tool: OpenAI.Chat.Completions.ChatCompletionTool;
  label: (args: Record<string, unknown>) => string;
  execute: (user: CurrentUser, args: Record<string, unknown>) => Promise<RicoActionResult>;
};

/**
 * Registro central das ações que o Rico sabe propor. Cada entrada é auto-suficiente
 * (schema pra IA, permissão exigida, texto de confirmação e execução real) — adicionar
 * uma ação nova ao Rico é só adicionar uma entrada aqui, sem mexer no resto do fluxo.
 */
const WRITE_TOOLS: Record<PendingAction["tool"], WriteToolDefinition> = {
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
    label: (args) => `Criar atividade "${args.name}"`,
    execute: async (user, args) => {
      const activity = await activityService.createActivity(user, {
        name: String(args.name ?? ""),
        code: args.code ? String(args.code) : null,
        description: args.description ? String(args.description) : null,
        unit: args.unit ? String(args.unit) : null,
      });
      return { ok: true, message: `Atividade "${activity.name}" criada.` };
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
    label: (args) => `Registrar "${args.qualificationTypeName}" para ${args.collaboratorName}`,
    execute: async (user, args) => {
      await qualificationService.createQualificationRecord(user, {
        collaboratorId: String(args.collaboratorId ?? ""),
        qualificationTypeId: String(args.qualificationTypeId ?? ""),
        completedDate: parseDateOnly(String(args.completedDate ?? "")),
        notes: args.notes ? String(args.notes) : null,
      });
      return { ok: true, message: `Qualificação registrada para ${args.collaboratorName}.` };
    },
  },
  criar_colaborador: {
    permission: PERMISSIONS.COLLABORATOR_MANAGE,
    tool: {
      type: "function",
      function: {
        name: "criar_colaborador",
        description: "Propõe cadastrar um novo colaborador — precisa de confirmação do usuário.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nome completo do colaborador" },
            functionId: { type: "string", description: "ID da função (use listar_funcoes antes), opcional" },
            functionName: { type: "string", description: "Nome da função, só para exibição na proposta, opcional" },
            areaId: { type: "string", description: "ID da área (use listar_areas antes), opcional" },
            areaName: { type: "string", description: "Nome da área, só para exibição na proposta, opcional" },
            phone: { type: "string", description: "Telefone, opcional" },
          },
          required: ["name"],
        },
      },
    },
    label: (args) => {
      const extra = [args.functionName, args.areaName].filter(Boolean).join(" — ");
      return `Cadastrar colaborador "${args.name}"${extra ? ` (${extra})` : ""}`;
    },
    execute: async (user, args) => {
      const collaborator = await collaboratorService.createCollaborator(user, {
        name: String(args.name ?? ""),
        functionId: args.functionId ? String(args.functionId) : null,
        areaId: args.areaId ? String(args.areaId) : null,
        phone: args.phone ? String(args.phone) : null,
      });
      return { ok: true, message: `Colaborador "${collaborator.name}" cadastrado.` };
    },
  },
  atualizar_status_nao_conformidade: {
    permission: PERMISSIONS.NONCONFORMITY_TREAT,
    tool: {
      type: "function",
      function: {
        name: "atualizar_status_nao_conformidade",
        description: "Propõe mudar o status de uma não conformidade — precisa de confirmação do usuário.",
        parameters: {
          type: "object",
          properties: {
            nonconformityId: {
              type: "string",
              description: "ID da NC (use nao_conformidades_abertas ou buscar antes pra achar pelo código)",
            },
            nonconformityCode: { type: "string", description: "Código da NC, só para exibição na proposta" },
            status: {
              type: "string",
              enum: [
                "ABERTA",
                "EM_ANALISE",
                "ACAO_DEFINIDA",
                "EM_EXECUCAO",
                "AGUARDANDO_VERIFICACAO",
                "CONCLUIDA",
                "ENCERRADA",
                "CANCELADA",
              ],
              description: "Novo status da não conformidade",
            },
          },
          required: ["nonconformityId", "nonconformityCode", "status"],
        },
      },
    },
    label: (args) =>
      `Mudar status de ${args.nonconformityCode} para "${NC_STATUS_LABELS[String(args.status)] ?? args.status}"`,
    execute: async (user, args) => {
      await setNonconformityStatus(user, String(args.nonconformityId ?? ""), args.status as NonconformityStatus);
      return { ok: true, message: `Status de ${args.nonconformityCode} atualizado.` };
    },
  },
  criar_entrega_epi: {
    permission: PERMISSIONS.COLLABORATOR_MANAGE,
    tool: {
      type: "function",
      function: {
        name: "criar_entrega_epi",
        description: "Propõe registrar a entrega de um EPI a um colaborador — precisa de confirmação do usuário.",
        parameters: {
          type: "object",
          properties: {
            collaboratorId: { type: "string", description: "ID do colaborador (use listar_colaboradores antes)" },
            collaboratorName: { type: "string", description: "Nome do colaborador, só para exibição na proposta" },
            epiTypeId: { type: "string", description: "ID do tipo de EPI (use listar_tipos_epi antes)" },
            epiTypeName: { type: "string", description: "Nome do tipo de EPI, só para exibição na proposta" },
            quantity: { type: "number", description: "Quantidade entregue" },
            reason: {
              type: "string",
              enum: [
                "PRIMEIRA_ENTREGA",
                "SUBSTITUICAO_DANO_JUSTIFICADO",
                "SUBSTITUICAO_DANO_PROPRIO_PERDA",
                "TROCA_DANIFICADO_VENCIDO",
                "DEVOLUCAO_DEMISSAO_MUDANCA_FUNCAO",
              ],
              description: "Motivo da entrega",
            },
          },
          required: ["collaboratorId", "collaboratorName", "epiTypeId", "epiTypeName", "quantity", "reason"],
        },
      },
    },
    label: (args) => `Registrar entrega de "${args.epiTypeName}" (qtd. ${args.quantity}) para ${args.collaboratorName}`,
    execute: async (user, args) => {
      await epiService.createEpiDelivery(user, {
        collaboratorId: String(args.collaboratorId ?? ""),
        epiTypeId: String(args.epiTypeId ?? ""),
        quantity: Number(args.quantity ?? 1),
        reason: args.reason as EpiDeliveryReason,
        deliveredAt: new Date(),
        traceable: false,
      });
      return { ok: true, message: `Entrega de "${args.epiTypeName}" registrada para ${args.collaboratorName}.` };
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
      return (await listChecklistBoardForUser(user))
        .filter((b) => b.type === "equipamento")
        .map((b) => ({
          codigo: b.equipment.code,
          nome: b.equipment.name,
          situacao: b.situation,
        }));
    case "nao_conformidades_abertas":
      return (await listNonconformitiesForUser(user, { overdue: false }))
        .filter((nc) => !["CONCLUIDA", "ENCERRADA", "CANCELADA"].includes(nc.status))
        .map((nc) => ({
          id: nc.id,
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
    case "listar_funcoes":
      return (await epiService.listJobFunctionsForCollaboratorForm(user)).map((f) => ({
        id: f.id,
        nome: f.name,
      }));
    case "listar_areas":
      return (await listAreas()).map((a) => ({
        id: a.id,
        nome: a.name,
        unidade: a.unit.name,
      }));
    case "listar_tipos_epi":
      return (await epiService.listEpiTypes(user, { onlyActive: true })).map((t) => ({
        id: t.id,
        nome: t.name,
      }));
    default:
      return { erro: "ferramenta desconhecida" };
  }
}

function proposeWriteAction(name: PendingAction["tool"], args: Record<string, unknown>): PendingAction {
  return { tool: name, args, label: WRITE_TOOLS[name].label(args) };
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
      return { reply, pendingAction: proposeWriteAction(writeCall.function.name as PendingAction["tool"], args) };
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

export type ProactiveSignal = {
  kind: "checklist_deviation";
  equipmentCode: string;
  questionTitle: string;
  answerValue: string;
};

function describeSignal(signal: ProactiveSignal): string {
  if (signal.kind === "checklist_deviation") {
    return `O colaborador está fazendo o checklist do equipamento ${signal.equipmentCode} e acabou de responder "${signal.answerValue}" na pergunta "${signal.questionTitle}" — uma resposta que caracteriza um desvio.`;
  }
  return "Algo relevante aconteceu no sistema.";
}

/**
 * Gera um comentário curto e proativo do Rico sobre algo que acabou de acontecer em outra
 * tela (hoje só o gatilho de desvio crítico no checklist). Chamada leve, sem ferramentas —
 * só uma resposta de 1-2 frases. Best-effort: falha silenciosa (retorna null), nunca deve
 * atrapalhar o fluxo da tela que disparou o sinal.
 */
export async function getProactiveTip(user: CurrentUser, signal: ProactiveSignal): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nVocê está comentando proativamente algo que acabou de acontecer, sem o usuário ter perguntado nada — não repita os fatos que ele já sabe (ele já viu o que respondeu), vá direto pra um comentário ou dica útil e curta, no máximo 2 frases.`,
        },
        { role: "user", content: describeSignal(signal) },
      ],
    });
    return response.choices[0]?.message.content?.trim() || null;
  } catch (error) {
    console.error("[rico] falha ao gerar dica proativa:", error);
    return null;
  }
}

/**
 * Cada bloco só entra no contexto se o usuário de fato tem a permissão daquela área —
 * é isso que impede o briefing de ficar preso só em segurança: um admin que também
 * enxerga RH e gestão recebe os três blocos, um colaborador comum só recebe segurança.
 */
export type DailyBriefingContext = {
  seguranca?: {
    previstos: number;
    realizados: number;
    atrasados: number;
    ncAbertas: number | null;
    topRisk: { equipmentCode: string; score: number } | null;
  };
  gestao?: {
    percentualCumprimento: number;
    equipamentosBloqueados: number;
    acoesVencidas: number;
  };
  rh?: {
    totalColaboradores: number;
    semSalarioDefinido: number;
  };
};

function describeBriefingContext(ctx: DailyBriefingContext): string {
  const blocks: string[] = [];

  if (ctx.seguranca) {
    const s = ctx.seguranca;
    const parts = [`Checklists hoje: ${s.realizados} realizados de ${s.previstos} previstos, ${s.atrasados} atrasados.`];
    if (s.ncAbertas !== null) parts.push(`Não conformidades abertas: ${s.ncAbertas}.`);
    if (s.topRisk) parts.push(`Equipamento com maior risco: ${s.topRisk.equipmentCode} (score ${s.topRisk.score}/100).`);
    blocks.push(`[Segurança] ${parts.join(" ")}`);
  }

  if (ctx.gestao) {
    const g = ctx.gestao;
    blocks.push(
      `[Gestão] Cumprimento geral de checklist: ${g.percentualCumprimento}%. Equipamentos bloqueados: ${g.equipamentosBloqueados}. Ações de plano vencidas: ${g.acoesVencidas}.`,
    );
  }

  if (ctx.rh) {
    const r = ctx.rh;
    blocks.push(`[RH] ${r.totalColaboradores} colaborador(es) ativo(s), sendo ${r.semSalarioDefinido} sem salário cadastrado ainda.`);
  }

  return blocks.join(" ");
}

/**
 * Briefing curto que aparece assim que o usuário abre o sistema — a mesma chamada leve e
 * best-effort do getProactiveTip, mas resumindo o estado do dia em vez de reagir a um evento.
 * Renderizado num Suspense boundary na home pra não atrasar o resto da página.
 */
export async function getDailyBriefing(user: CurrentUser, context: DailyBriefingContext): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const description = describeBriefingContext(context);
  if (!description) return null;

  const areaCount = [context.seguranca, context.gestao, context.rh].filter(Boolean).length;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 160,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nVocê está escrevendo o briefing que aparece assim que ${user.name.split(" ")[0]} abre o sistema — 2 a 3 frases, tom direto e humano. A tela já mostra uma saudação (ex: "Boa tarde, ${user.name.split(" ")[0]}") logo acima do seu texto, então NÃO repita esse cumprimento nem abra com "bom dia/boa tarde/boa noite" — vá direto ao ponto. Os dados vêm marcados por área (ex: [Segurança], [RH], [Gestão]) conforme o que essa pessoa realmente acompanha — ${areaCount > 1 ? "toque em cada área presente, não fique só numa delas" : "fale só da área que foi passada"}. Destaque o que mais importa, não liste todos os números soltos. Se estiver tudo bem, comente isso brevemente sem soar robótico. Nunca invente números além dos que foram passados a você.`,
        },
        { role: "user", content: description },
      ],
    });
    return response.choices[0]?.message.content?.trim() || null;
  } catch (error) {
    console.error("[rico] falha ao gerar briefing diário:", error);
    return null;
  }
}

export type AccidentInsightContext = {
  year: number;
  totalCount: number;
  monthly: { label: string; count: number }[];
  topType: { label: string; count: number } | null;
};

function describeAccidentInsightContext(ctx: AccidentInsightContext): string | null {
  if (ctx.totalCount === 0) return null;
  const monthsWithData = ctx.monthly.filter((m) => m.count > 0).map((m) => `${m.label}: ${m.count}`);
  const parts = [`Total de ${ctx.totalCount} acidente(s)/incidente(s) registrado(s) em ${ctx.year}.`];
  if (monthsWithData.length > 0) parts.push(`Por mês: ${monthsWithData.join(", ")}.`);
  if (ctx.topType) parts.push(`Tipo mais recorrente: ${ctx.topType.label} (${ctx.topType.count} ocorrência(s)).`);
  return parts.join(" ");
}

/**
 * Comentário curto do Rico pro dashboard de Acidentes — mesma lógica best-effort do
 * getProactiveTip/getDailyBriefing, só que reagindo à distribuição mensal e ao tipo mais
 * recorrente em vez de um evento pontual ou o estado do dia.
 */
export async function getAccidentInsight(user: CurrentUser, context: AccidentInsightContext): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const description = describeAccidentInsightContext(context);
  if (!description) return null;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 140,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\nVocê está comentando o painel de acidentes/incidentes do ano pra ${user.name.split(" ")[0]} — 1 a 2 frases, tom direto. Destaque o que mais chama atenção (tipo mais recorrente, mês com mais casos, ou uma tendência de queda/alta), como se fosse uma observação de quem realmente olhou os números, não uma repetição fria deles. Nunca invente números além dos que foram passados a você.`,
        },
        { role: "user", content: description },
      ],
    });
    return response.choices[0]?.message.content?.trim() || null;
  } catch (error) {
    console.error("[rico] falha ao gerar insight de acidentes:", error);
    return null;
  }
}

/** Executa de verdade uma ação de escrita já confirmada pelo usuário no chat. */
export async function executeRicoAction(
  user: CurrentUser,
  tool: PendingAction["tool"],
  args: Record<string, unknown>,
): Promise<RicoActionResult> {
  const definition = WRITE_TOOLS[tool];
  if (!definition || !user.permissions.has(definition.permission)) {
    return { ok: false, error: "Você não tem permissão para essa ação." };
  }

  try {
    return await definition.execute(user, args);
  } catch (error) {
    console.error(`[rico] falha ao executar ação confirmada (${tool}):`, error);
    return { ok: false, error: "Não foi possível concluir a ação." };
  }
}
