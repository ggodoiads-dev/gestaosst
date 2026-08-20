import "server-only";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { parseAfdt } from "@/domain/time-clock/afdt-parser";
import { parseAej } from "@/domain/time-clock/aej-parser";
import { extractFirstTextFile } from "@/lib/zip-extract";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import { APP_TIMEZONE, formatTime } from "@/lib/dates";
import { CHECKLIST_JUSTIFICATION_REASONS, type ChecklistJustificationReason } from "@/domain/time-clock/checklist-justification-reasons";
import type { CurrentUser } from "@/server/auth/current-user";
import { requirePermission, hasPermission, ForbiddenError } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";

const LATE_TOLERANCE_MINUTES = 5;

/** RH lida com a importação do ponto; Supervisão acompanha aderência em Indicadores — os dois
 * precisam poder justificar um checklist não realizado, sem precisar do outro nível de acesso. */
function requireHrOrSupervisao(user: CurrentUser): void {
  if (!hasPermission(user, PERMISSIONS.HR_MANAGE) && !hasPermission(user, PERMISSIONS.INDICATORS_VIEW_AREA)) {
    throw new ForbiddenError();
  }
}

/** RH e quem tem visão consolidada enxergam todo mundo; um supervisor só com INDICATORS_VIEW_AREA
 * fica restrito às próprias áreas — mesmo critério de `areaScope` em indicators.service.ts. */
function adherenceAreaScope(user: CurrentUser): string[] | undefined {
  if (hasPermission(user, PERMISSIONS.HR_MANAGE) || hasPermission(user, PERMISSIONS.INDICATORS_VIEW_CONSOLIDATED)) {
    return undefined;
  }
  return Array.from(user.areaIds);
}

export type TimeClockImportSummary = {
  totalRecords: number;
  matched: number;
  unmatched: number;
  unmatchedPis: string[];
  ignoredLines: number;
};

export class InvalidTimeClockFileError extends Error {}

/**
 * Importa um arquivo do relógio de ponto — aceita tanto o AFD (.txt, identifica cada marcação
 * pelo PIS) quanto o AEJ (.zip com um .txt assinado dentro, identifica cada marcação direto pela
 * matrícula — formato mais rico e mais fácil de casar, já que a matrícula é o mesmo número curto
 * já cadastrado nos colaboradores). Casa cada marcação e grava de forma idempotente (`createMany`
 * + `skipDuplicates`, chave `[pis, timestamp, markNumber]`) — reenviar o mesmo arquivo não
 * duplica nada. Quando uma marcação já gravada antes (sem colaborador correspondente na época)
 * passa a ter dono, o `updateMany` final corrige o vínculo sem precisar reimportar tudo de novo.
 */
export async function importTimeClockFile(
  user: CurrentUser,
  buffer: Buffer,
  filename: string,
): Promise<TimeClockImportSummary> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const isZip = /\.zip$/i.test(filename) || (buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b);

  const { marks, ignoredLines } = await (async () => {
    if (isZip) {
      const extracted = await extractFirstTextFile(buffer);
      if (!extracted) {
        throw new InvalidTimeClockFileError("Não encontrei nenhum arquivo .txt dentro do .zip.");
      }
      return parseAej(extracted.content);
    }
    return parseAfdt(buffer.toString("utf-8"));
  })();

  const distinctPis = [...new Set(marks.map((m) => m.pis))];
  const collaborators =
    distinctPis.length > 0
      ? await db.collaborator.findMany({
          where: { OR: [{ pis: { in: distinctPis } }, { matricula: { in: distinctPis } }] },
        })
      : [];

  const collaboratorByPis = new Map<string, (typeof collaborators)[number]>();
  for (const c of collaborators) {
    if (c.pis && distinctPis.includes(c.pis) && !collaboratorByPis.has(c.pis)) {
      collaboratorByPis.set(c.pis, c);
    }
  }
  for (const c of collaborators) {
    if (c.matricula && distinctPis.includes(c.matricula) && !collaboratorByPis.has(c.matricula)) {
      collaboratorByPis.set(c.matricula, c);
    }
  }

  const unmatchedPis = new Set<string>();
  let matched = 0;

  const data = marks.map((mark) => {
    const collaborator = collaboratorByPis.get(mark.pis);
    if (collaborator) matched++;
    else unmatchedPis.add(mark.pis);

    return {
      collaboratorId: collaborator?.id ?? null,
      pis: mark.pis,
      timestamp: mark.timestamp,
      markType: mark.markType,
      markNumber: mark.markNumber,
      origin: mark.origin,
      reason: mark.reason,
      importedById: user.id,
    };
  });

  if (data.length > 0) {
    await db.timeClockRecord.createMany({ data, skipDuplicates: true });
  }

  for (const [pis, collaborator] of collaboratorByPis) {
    await db.timeClockRecord.updateMany({ where: { pis, collaboratorId: null }, data: { collaboratorId: collaborator.id } });
  }

  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "TimeClockImport",
    entityId: crypto.randomUUID(),
    newValue: { totalRecords: marks.length, matched, unmatched: unmatchedPis.size, ignoredLines },
  });

  return {
    totalRecords: marks.length,
    matched,
    unmatched: marks.length - matched,
    unmatchedPis: [...unmatchedPis],
    ignoredLines,
  };
}

export type UnmatchedTimeClockPis = {
  pis: string;
  recordCount: number;
  firstTimestamp: Date;
  lastTimestamp: Date;
};

/** Códigos do relógio de ponto sem colaborador vinculado — base pra reconciliação manual, já
 * que o arquivo AFDT não traz nome nenhum, só esse código e os horários. Não lista os códigos
 * marcados como ignorados (ex: código de erro do relógio, sobra de arquivo antigo). */
export async function listUnmatchedTimeClockPis(user: CurrentUser): Promise<UnmatchedTimeClockPis[]> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const [groups, ignored] = await Promise.all([
    db.timeClockRecord.groupBy({
      by: ["pis"],
      where: { collaboratorId: null },
      _count: { _all: true },
      _min: { timestamp: true },
      _max: { timestamp: true },
    }),
    db.ignoredTimeClockPis.findMany({ select: { pis: true } }),
  ]);

  const ignoredSet = new Set(ignored.map((i) => i.pis));

  return groups
    .filter((g) => !ignoredSet.has(g.pis))
    .map((g) => ({
      pis: g.pis,
      recordCount: g._count._all,
      firstTimestamp: g._min.timestamp!,
      lastTimestamp: g._max.timestamp!,
    }))
    .sort((a, b) => b.recordCount - a.recordCount);
}

/** Marca um código como "não vale a pena investigar" (ex: código de erro do relógio, sobra de
 * arquivo antigo) — só some da lista de reconciliação, nenhuma marcação já importada é apagada. */
export async function ignoreTimeClockPis(user: CurrentUser, pis: string): Promise<void> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  await db.ignoredTimeClockPis.upsert({
    where: { pis },
    update: {},
    create: { pis, ignoredById: user.id },
  });
}

/** Ignora de uma vez todos os códigos hoje sem colaborador vinculado — atalho pra limpar uma
 * lista cheia de sobras de importações antigas sem precisar clicar um por um. */
export async function ignoreAllUnmatchedTimeClockPis(user: CurrentUser): Promise<{ ignoredCount: number }> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const unmatched = await listUnmatchedTimeClockPis(user);
  if (unmatched.length === 0) return { ignoredCount: 0 };

  await db.ignoredTimeClockPis.createMany({
    data: unmatched.map((u) => ({ pis: u.pis, ignoredById: user.id })),
    skipDuplicates: true,
  });

  return { ignoredCount: unmatched.length };
}

/** Vincula manualmente um código do relógio a um colaborador — usado quando não há como saber o
 * PIS de antemão (o arquivo AFDT não traz nome). Preenche o PIS do colaborador só se ele ainda
 * não tiver um (nunca sobrescreve um PIS já cadastrado por engano) e religa todas as marcações
 * daquele código já importadas, sem precisar reimportar o arquivo. */
export async function linkTimeClockPisToCollaborator(
  user: CurrentUser,
  pis: string,
  collaboratorId: string,
): Promise<{ linkedRecords: number }> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);

  const collaborator = await db.collaborator.findUniqueOrThrow({ where: { id: collaboratorId } });

  const result = await db.$transaction(async (tx) => {
    if (!collaborator.pis) {
      await tx.collaborator.update({ where: { id: collaboratorId }, data: { pis } });
    }
    return tx.timeClockRecord.updateMany({ where: { pis, collaboratorId: null }, data: { collaboratorId } });
  });

  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entityType: "Collaborator",
    entityId: collaboratorId,
    newValue: { pis, linkedTimeClockRecords: result.count },
  });

  return { linkedRecords: result.count };
}

export type TimeClockAnomalyType = "ATRASO" | "FALTA" | "CHECKLIST_PENDENTE" | "BATIDA_IMPAR";

export type TimeClockAnomaly = {
  collaboratorId: string;
  collaboratorName: string;
  date: string; // yyyy-MM-dd
  type: TimeClockAnomalyType;
  detail: string;
};

/** Chave de dia a partir de uma data "de negócio" já âncorada ao meio-dia local (Turno.startDate,
 * ScheduleDayNote.date, limites do período pedido) — mesmo padrão de `localDateKey` em schedule.service.ts. */
function dayKeyFromLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Chave de dia a partir de um instante real (TimeClockRecord.timestamp, ChecklistExecution.startedAt)
 * — precisa converter explicitamente pro fuso de São Paulo, já que o processo pode rodar em UTC. */
function dayKeyFromTimestamp(timestamp: Date): string {
  return formatInTimeZone(timestamp, APP_TIMEZONE, "yyyy-MM-dd");
}

/** Chave de "dia de trabalho" ancorada no turno, não na meia-noite — evita que um turno noturno
 * (ex: entra 22h, sai 7h do dia seguinte) seja partido em dois dias de calendário diferentes. Sem
 * isso, a "primeira entrada" achada no dia seguinte era na verdade a volta do intervalo, não a
 * entrada real, gerando atraso e batida ímpar falsos pra quem trabalha de noite.
 *
 * O corte do dia fica 12h OPOSTAS ao horário de início do turno (não exatamente nesse horário):
 * bater o corte em cima do horário de início faria uma entrada só alguns minutos adiantada (comum
 * na prática) cair no dia de calendário errado. Cortando no ponto mais distante do início do
 * turno, tanto adiantar quanto atrasar a entrada em até ~12h continua caindo no mesmo dia de
 * trabalho. Sem horário de início cadastrado, cai pro dia-calendário puro. */
function workdayKeyFromTimestamp(timestamp: Date, shiftStartTime: string | null | undefined): string {
  if (!shiftStartTime) return dayKeyFromTimestamp(timestamp);
  const [startHour, startMinute] = shiftStartTime.split(":").map(Number);
  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) return dayKeyFromTimestamp(timestamp);

  const cutoffTotalMinutes = (startHour * 60 + startMinute + 12 * 60) % (24 * 60);
  const cutoffHour = Math.floor(cutoffTotalMinutes / 60);
  const cutoffMinute = cutoffTotalMinutes % 60;

  const local = toZonedTime(timestamp, APP_TIMEZONE);
  const shifted = new Date(local);
  shifted.setHours(shifted.getHours() - cutoffHour, shifted.getMinutes() - cutoffMinute, shifted.getSeconds(), 0);

  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type ChecklistLedgerEntry = {
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  done: boolean;
};

type Evaluation = {
  anomalies: TimeClockAnomaly[];
  /** Um item por dia em que o colaborador precisava de checklist (requiresChecklist) e
   * trabalhou (bateu ponto) — a base pra calcular aderência, feito ou não. */
  checklistLedger: ChecklistLedgerEntry[];
};

/**
 * Cruza as batidas de ponto importadas com escala, checklist e o próprio padrão par/ímpar de
 * marcações do dia. `from`/`to` são datas de negócio (meio-dia local). Núcleo compartilhado por
 * `getTimeClockReport` (todas as ocorrências) e `getChecklistAdherence` (só a aderência de
 * checklist) — pra não recalcular a mesma coisa duas vezes com lógicas que podem divergir.
 */
async function evaluateRange(range: { from: Date; to: Date }, options?: { areaIds?: string[] }): Promise<Evaluation> {
  const rangeStartUtc = fromZonedTime(
    new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate(), 0, 0, 0),
    APP_TIMEZONE,
  );
  const rangeEndUtc = fromZonedTime(
    new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59),
    APP_TIMEZONE,
  );

  const collaborators = await db.collaborator.findMany({
    where: { active: true, areaId: options?.areaIds ? { in: options.areaIds } : undefined },
    include: { turno: { include: { scheduleType: true } } },
  });
  const collaboratorIds = collaborators.map((c) => c.id);
  if (collaboratorIds.length === 0) return { anomalies: [], checklistLedger: [] };

  const userIds = collaborators.filter((c) => c.userId).map((c) => c.userId as string);

  const [records, notes, executions] = await Promise.all([
    db.timeClockRecord.findMany({
      where: { collaboratorId: { in: collaboratorIds }, timestamp: { gte: rangeStartUtc, lte: rangeEndUtc } },
      orderBy: { timestamp: "asc" },
    }),
    db.scheduleDayNote.findMany({
      where: { collaboratorId: { in: collaboratorIds }, date: { gte: range.from, lte: range.to } },
    }),
    userIds.length > 0
      ? db.checklistExecution.findMany({
          where: { executedById: { in: userIds }, startedAt: { gte: rangeStartUtc, lte: rangeEndUtc } },
          select: { executedById: true, startedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const collaboratorById = new Map(collaborators.map((c) => [c.id, c]));

  const recordsByCollaboratorDay = new Map<string, typeof records>();
  for (const rec of records) {
    if (!rec.collaboratorId) continue;
    const shiftStartTime = collaboratorById.get(rec.collaboratorId)?.turno?.startTime;
    const key = `${rec.collaboratorId}-${workdayKeyFromTimestamp(rec.timestamp, shiftStartTime)}`;
    const arr = recordsByCollaboratorDay.get(key);
    if (arr) arr.push(rec);
    else recordsByCollaboratorDay.set(key, [rec]);
  }

  const noteByKey = new Map(notes.map((n) => [`${n.collaboratorId}-${dayKeyFromLocalDate(n.date)}`, n]));

  const executionDaysByUser = new Map<string, Set<string>>();
  for (const exec of executions) {
    const day = dayKeyFromTimestamp(exec.startedAt);
    const set = executionDaysByUser.get(exec.executedById);
    if (set) set.add(day);
    else executionDaysByUser.set(exec.executedById, new Set([day]));
  }

  const anomalies: TimeClockAnomaly[] = [];
  const checklistLedger: ChecklistLedgerEntry[] = [];

  for (const collaborator of collaborators) {
    const cursor = new Date(range.from);
    while (cursor <= range.to) {
      const dayKey = dayKeyFromLocalDate(cursor);
      const dayRecords = (recordsByCollaboratorDay.get(`${collaborator.id}-${dayKey}`) ?? [])
        .slice()
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const hasPunches = dayRecords.length > 0;

      if (collaborator.turno) {
        const note = noteByKey.get(`${collaborator.id}-${dayKey}`);
        const scheduled = note ? note.overrideStatus : getCollaboratorDayStatus(cursor, collaborator);

        if (scheduled === "TRABALHO" && !hasPunches) {
          anomalies.push({
            collaboratorId: collaborator.id,
            collaboratorName: collaborator.name,
            date: dayKey,
            type: "FALTA",
            detail: "Nenhuma batida de ponto registrada no dia",
          });
        }
      }

      if (hasPunches) {
        if (collaborator.turno?.startTime) {
          const firstEntrada = dayRecords.find((r) => r.markType === "ENTRADA");
          if (firstEntrada) {
            const [schedHour, schedMinute] = collaborator.turno.startTime.split(":").map(Number);
            const localEntrada = toZonedTime(firstEntrada.timestamp, APP_TIMEZONE);
            const actualMinutes = localEntrada.getHours() * 60 + localEntrada.getMinutes();
            const scheduledMinutes = schedHour * 60 + schedMinute;
            const lateBy = actualMinutes - scheduledMinutes;
            if (lateBy > LATE_TOLERANCE_MINUTES) {
              anomalies.push({
                collaboratorId: collaborator.id,
                collaboratorName: collaborator.name,
                date: dayKey,
                type: "ATRASO",
                detail: `${lateBy} min de atraso (previsto ${collaborator.turno.startTime}, batido às ${formatTime(firstEntrada.timestamp)})`,
              });
            }
          }
        }

        if (dayRecords.length % 2 !== 0) {
          anomalies.push({
            collaboratorId: collaborator.id,
            collaboratorName: collaborator.name,
            date: dayKey,
            type: "BATIDA_IMPAR",
            detail: `${dayRecords.length} batida(s) no dia — número ímpar, sinal de esquecimento`,
          });
        }

        if (collaborator.requiresChecklist) {
          const done = collaborator.userId ? Boolean(executionDaysByUser.get(collaborator.userId)?.has(dayKey)) : false;
          checklistLedger.push({ collaboratorId: collaborator.id, collaboratorName: collaborator.name, date: dayKey, done });

          if (!done) {
            anomalies.push({
              collaboratorId: collaborator.id,
              collaboratorName: collaborator.name,
              date: dayKey,
              type: "CHECKLIST_PENDENTE",
              detail: collaborator.userId
                ? "Bateu ponto mas não realizou nenhum checklist no dia"
                : "Precisa de checklist, mas ainda não tem acesso ao sistema pra registrar",
            });
          }
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  anomalies.sort((a, b) => (a.date === b.date ? a.collaboratorName.localeCompare(b.collaboratorName) : a.date < b.date ? 1 : -1));

  return { anomalies, checklistLedger };
}

/**
 * Cruza as batidas de ponto importadas com escala, checklist e o próprio padrão par/ímpar de
 * marcações do dia, gerando as ocorrências: atraso, falta, checklist não realizado e batida
 * ímpar (sinal de esquecimento).
 */
export async function getTimeClockReport(
  user: CurrentUser,
  range: { from: Date; to: Date },
): Promise<TimeClockAnomaly[]> {
  requirePermission(user, PERMISSIONS.HR_MANAGE);
  const { anomalies } = await evaluateRange(range);
  return anomalies;
}

export type ChecklistJustificationInfo = {
  reason: ChecklistJustificationReason;
  reasonLabel: string;
  countsAsCompliant: boolean;
  note: string | null;
};

export type ChecklistAdherencePendingDay = {
  collaboratorId: string;
  collaboratorName: string;
  date: string;
  detail: string;
  justification: ChecklistJustificationInfo | null;
};

export type ChecklistAdherenceReport = {
  requiredDays: number;
  compliantDays: number;
  adherencePercent: number;
  pendingDays: ChecklistAdherencePendingDay[];
};

/**
 * Aderência de checklist no período: dos dias em que alguém precisava fazer checklist (e
 * trabalhou), quantos foram feitos de verdade ou justificados com um motivo que conta como
 * cumprido. Motivos que não contam (ex: "Sem justificativa válida") ficam documentados mas não
 * melhoram o número — é isso que evita que uma justificativa qualquer infle o indicador.
 */
export async function getChecklistAdherence(
  user: CurrentUser,
  range: { from: Date; to: Date },
): Promise<ChecklistAdherenceReport> {
  requireHrOrSupervisao(user);

  const { anomalies, checklistLedger } = await evaluateRange(range, { areaIds: adherenceAreaScope(user) });
  const requiredDays = checklistLedger.length;
  const doneDays = checklistLedger.filter((d) => d.done).length;

  const pendingAnomalies = anomalies.filter((a) => a.type === "CHECKLIST_PENDENTE");
  const collaboratorIds = [...new Set(pendingAnomalies.map((a) => a.collaboratorId))];

  const justifications =
    collaboratorIds.length > 0
      ? await db.checklistJustification.findMany({
          where: { collaboratorId: { in: collaboratorIds }, date: { gte: range.from, lte: range.to } },
        })
      : [];
  const justificationByKey = new Map(justifications.map((j) => [`${j.collaboratorId}-${dayKeyFromLocalDate(j.date)}`, j]));

  let justifiedCompliant = 0;
  const pendingDays: ChecklistAdherencePendingDay[] = pendingAnomalies.map((a) => {
    const justification = justificationByKey.get(`${a.collaboratorId}-${a.date}`);
    let info: ChecklistJustificationInfo | null = null;
    if (justification) {
      const meta = CHECKLIST_JUSTIFICATION_REASONS[justification.reason];
      info = { reason: justification.reason, reasonLabel: meta.label, countsAsCompliant: meta.countsAsCompliant, note: justification.note };
      if (meta.countsAsCompliant) justifiedCompliant++;
    }
    return { collaboratorId: a.collaboratorId, collaboratorName: a.collaboratorName, date: a.date, detail: a.detail, justification: info };
  });

  const compliantDays = doneDays + justifiedCompliant;
  const adherencePercent = requiredDays === 0 ? 100 : Math.round((compliantDays / requiredDays) * 1000) / 10;

  return { requiredDays, compliantDays, adherencePercent, pendingDays };
}

/** Registra (ou substitui) a justificativa de um dia de checklist não realizado. */
export async function justifyChecklistPending(
  user: CurrentUser,
  input: { collaboratorId: string; date: Date; reason: ChecklistJustificationReason; note: string | null },
) {
  requireHrOrSupervisao(user);

  const allowedAreaIds = adherenceAreaScope(user);
  if (allowedAreaIds) {
    const collaborator = await db.collaborator.findUniqueOrThrow({ where: { id: input.collaboratorId } });
    if (!collaborator.areaId || !allowedAreaIds.includes(collaborator.areaId)) {
      throw new ForbiddenError();
    }
  }

  const justification = await db.checklistJustification.upsert({
    where: { collaboratorId_date: { collaboratorId: input.collaboratorId, date: input.date } },
    update: { reason: input.reason, note: input.note, createdById: user.id },
    create: {
      collaboratorId: input.collaboratorId,
      date: input.date,
      reason: input.reason,
      note: input.note,
      createdById: user.id,
    },
  });

  await recordAudit({
    userId: user.id,
    action: "CREATE",
    entityType: "ChecklistJustification",
    entityId: justification.id,
    newValue: { collaboratorId: input.collaboratorId, date: input.date, reason: input.reason, note: input.note },
  });

  return justification;
}
