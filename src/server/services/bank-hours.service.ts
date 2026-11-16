import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { ForbiddenError, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { APP_TIMEZONE } from "@/lib/dates";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import { nationalHolidays, type Holiday } from "@/domain/bank-hours/holidays";
import { computeBalance, type BankBalance } from "@/domain/bank-hours/balance";

/** O controle de feriado trabalhado começa neste dia (Nossa Senhora Aparecida): feriados anteriores a ele são desconsiderados. */
export const BANK_HOURS_START = "2026-10-12";

function requireBankHours(user: CurrentUser): void {
  if (!hasPermission(user, PERMISSIONS.SCHEDULE_MANAGE)) throw new ForbiddenError();
}

function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Dia (AAAA-MM-DD) de um lançamento guardado ao meio-dia UTC. */
function entryKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Feriados nacionais do controle (a partir de BANK_HOURS_START) que já chegaram, do mais antigo ao mais recente. */
function trackedHolidaysUntilToday(todayKey: string): Holiday[] {
  const years: number[] = [];
  for (let y = Number(BANK_HOURS_START.slice(0, 4)); y <= Number(todayKey.slice(0, 4)); y++) years.push(y);
  return years.flatMap((y) => nationalHolidays(y)).filter((h) => h.date >= BANK_HOURS_START && h.date <= todayKey);
}

/**
 * Credita sozinho 1 dia de folga a quem trabalhou em cada feriado nacional já ocorrido (a partir de 12/10/2026). "Trabalhou" vem só da escala salva:
 * escalado para trabalhar no dia, sem falta, atestado, férias ou folga lançados (a exceção lançada na escala vence o cálculo do turno). Idempotente:
 * não credita duas vezes o mesmo feriado para a mesma pessoa, nem repõe um crédito que foi retirado à mão. Chamada pela tela e pela rotina diária.
 */
export async function autoCreditHolidayWork(actor: { id: string; name: string }): Promise<{ created: number }> {
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const holidays = trackedHolidaysUntilToday(todayKey);
  if (holidays.length === 0) return { created: 0 };

  const [collaborators, noteRows] = await Promise.all([
    db.collaborator.findMany({ where: { active: true }, include: { turno: { include: { scheduleType: true } } } }),
    db.scheduleDayNote.findMany({
      where: { date: { gte: new Date(`${BANK_HOURS_START}T00:00:00`), lt: new Date(new Date(`${todayKey}T00:00:00`).getTime() + 2 * 24 * 60 * 60 * 1000) } },
      select: { collaboratorId: true, date: true, overrideStatus: true, status: true },
    }),
  ]);
  const noteByKey = new Map(noteRows.map((n) => [`${n.collaboratorId}|${localKey(n.date)}`, n]));

  const data: { collaboratorId: string; date: Date; days: number; kind: string; holidayName: string; dedupKey: string; createdById: string; createdByName: string }[] = [];
  for (const h of holidays) {
    const [y, m, d] = h.date.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    for (const c of collaborators) {
      if (c.admissionDate && c.admissionDate > date) continue;
      const note = noteByKey.get(`${c.id}|${h.date}`);
      const effective = note ? note.overrideStatus : getCollaboratorDayStatus(date, c);
      if (effective !== "TRABALHO") continue;
      if (note?.status === "BH_MAIS") continue; // já lançado como BH+ na escala
      data.push({
        collaboratorId: c.id,
        date: new Date(`${h.date}T12:00:00Z`),
        days: 1,
        kind: "FERIADO",
        holidayName: h.name,
        dedupKey: `h:${c.id}:${h.date}`,
        createdById: actor.id,
        createdByName: actor.name,
      });
    }
  }
  if (data.length === 0) return { created: 0 };
  try {
    const result = await db.bankHourEntry.createMany({ data, skipDuplicates: true });
    return { created: result.count };
  } catch (error) {
    // Tabela ainda não criada no banco: a tela segue funcionando só com o que vem da escala.
    console.error("[banco-de-horas] não consegui creditar os feriados:", error);
    return { created: 0 };
  }
}

export type BankLedgerLine = { id: string | null; date: string; days: number; label: string; note: string | null; by: string | null; removable: boolean };

export type BankHoursOverview = {
  year: number;
  tableReady: boolean;
  /** Feriados do ano que entram no controle (a partir de 12/10/2026), com quantos créditos cada um já tem. */
  holidays: (Holiday & { past: boolean; creditedCount: number })[];
  people: ({ collaboratorId: string; name: string; turnoName: string | null; functionName: string | null } & BankBalance & { ledger: BankLedgerLine[] })[];
};

/** Visão geral do banco de horas: saldo de cada colaborador (feriados creditados + BH+ - BH- da escala + ajustes manuais). */
export async function getBankHoursOverview(user: CurrentUser, year: number): Promise<BankHoursOverview> {
  requireBankHours(user);
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  const [collaborators, notes] = await Promise.all([
    db.collaborator.findMany({
      where: { active: true },
      include: { turno: true, function: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.scheduleDayNote.findMany({
      where: { status: { in: ["BH_MAIS", "BH_MENOS"] } },
      select: { collaboratorId: true, date: true, status: true, notes: true },
    }),
  ]);

  let tableReady = true;
  let entries: Awaited<ReturnType<typeof db.bankHourEntry.findMany>> = [];
  try {
    entries = await db.bankHourEntry.findMany({ orderBy: { date: "asc" } });
  } catch (error) {
    tableReady = false;
    console.error("[banco-de-horas] tabela indisponível:", error);
  }

  const entriesBy = new Map<string, typeof entries>();
  for (const e of entries) entriesBy.set(e.collaboratorId, [...(entriesBy.get(e.collaboratorId) ?? []), e]);
  const notesBy = new Map<string, typeof notes>();
  for (const n of notes) notesBy.set(n.collaboratorId, [...(notesBy.get(n.collaboratorId) ?? []), n]);

  const people = collaborators.map((c) => {
    const mine = entriesBy.get(c.id) ?? [];
    const myNotes = notesBy.get(c.id) ?? [];
    const balance = computeBalance(
      mine.map((e) => ({ date: entryKey(e.date), days: e.days })),
      myNotes.map((n) => ({ date: localKey(n.date), status: n.status as "BH_MAIS" | "BH_MENOS" })),
    );
    const entryDates = new Set(mine.map((e) => entryKey(e.date)));
    const ledger: BankLedgerLine[] = [
      ...mine.map((e) => ({
        id: e.id,
        date: entryKey(e.date),
        days: e.days,
        label:
          e.kind === "FERIADO"
            ? e.days === 0
              ? `Crédito do feriado retirado${e.holidayName ? ` — ${e.holidayName}` : ""}`
              : `Feriado trabalhado${e.holidayName ? ` — ${e.holidayName}` : ""}`
            : e.days >= 0
              ? "Ajuste manual (crédito)"
              : "Ajuste manual (débito)",
        note: e.note,
        by: e.createdByName,
        // Crédito de feriado é retirado (vira zero e não volta sozinho); o manual é apagado. Um já retirado não tem mais o que fazer.
        removable: !(e.kind === "FERIADO" && e.days === 0),
      })),
      ...myNotes.map((n) => ({
        id: null,
        date: localKey(n.date),
        days: n.status === "BH_MAIS" ? (entryDates.has(localKey(n.date)) ? 0 : 1) : -1,
        label: n.status === "BH_MAIS" ? "BH+ lançado na escala" : "Folga de banco de horas (BH-) na escala",
        note: n.notes || null,
        by: null,
        removable: false,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    return { collaboratorId: c.id, name: c.name, turnoName: c.turno?.name ?? null, functionName: c.function?.name ?? null, ...balance, ledger };
  });

  const creditedBy = new Map<string, number>();
  for (const e of entries) if (e.kind === "FERIADO" && e.days > 0) creditedBy.set(entryKey(e.date), (creditedBy.get(entryKey(e.date)) ?? 0) + 1);

  return {
    year,
    tableReady,
    holidays: nationalHolidays(year)
      .filter((h) => h.date >= BANK_HOURS_START)
      .map((h) => ({ ...h, past: h.date <= todayKey, creditedCount: creditedBy.get(h.date) ?? 0 })),
    people,
  };
}

/** Lançamento manual (troca, acordo, correção): dias positivos creditam, negativos abatem. */
export async function addManualBankEntry(user: CurrentUser, input: { collaboratorId: string; dateKey: string; days: number; note: string }) {
  requireBankHours(user);
  if (!Number.isFinite(input.days) || input.days === 0 || Math.abs(input.days) > 30) throw new Error("Informe uma quantidade de dias diferente de zero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey)) throw new Error("Data inválida.");
  const note = input.note.trim();
  if (note.length < 3) throw new Error("Explique o motivo (ex.: troca de folga com fulano).");
  await db.collaborator.findUniqueOrThrow({ where: { id: input.collaboratorId }, select: { id: true } });
  await db.bankHourEntry.create({
    data: {
      collaboratorId: input.collaboratorId,
      date: new Date(`${input.dateKey}T12:00:00Z`),
      days: Math.round(input.days * 100) / 100,
      kind: "MANUAL",
      note,
      createdById: user.id,
      createdByName: user.name,
    },
  });
}

/** Retira um lançamento do banco. Ajuste manual é apagado. Crédito automático de feriado vira zero (fica no extrato) para a rotina não creditar de novo. */
export async function deleteBankEntry(user: CurrentUser, id: string) {
  requireBankHours(user);
  const entry = await db.bankHourEntry.findUnique({ where: { id } });
  if (!entry) return;
  if (entry.kind === "FERIADO") {
    await db.bankHourEntry.update({ where: { id }, data: { days: 0, note: `Crédito retirado por ${user.name}` } });
    return;
  }
  await db.bankHourEntry.delete({ where: { id } });
}
