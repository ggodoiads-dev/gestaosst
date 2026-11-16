import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/current-user";
import { ForbiddenError, hasPermission } from "@/server/auth/current-user";
import { PERMISSIONS } from "@/domain/shared/permissions";
import { APP_TIMEZONE } from "@/lib/dates";
import { getCollaboratorDayStatus } from "@/domain/schedule/schedule-calendar";
import { holidayOn, nationalHolidays, type Holiday } from "@/domain/bank-hours/holidays";
import { computeBalance, type BankBalance } from "@/domain/bank-hours/balance";

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

export type BankLedgerLine = { id: string | null; date: string; days: number; label: string; note: string | null; by: string | null; removable: boolean };

export type BankHoursOverview = {
  year: number;
  tableReady: boolean;
  holidays: (Holiday & { past: boolean; pendingCount: number; creditedCount: number })[];
  /** Feriados já passados com gente escalada para trabalhar que ainda não foi creditada. */
  suggestions: {
    holiday: Holiday;
    people: { collaboratorId: string; name: string; turnoName: string | null }[];
  }[];
  people: ({ collaboratorId: string; name: string; turnoName: string | null; functionName: string | null } & BankBalance & { ledger: BankLedgerLine[] })[];
};

/** Visão geral do banco de horas: saldo de cada colaborador (feriados creditados + BH+ - BH- da escala + ajustes) e os feriados trabalhados ainda sem crédito.
 * Quem trabalhou no feriado vem SÓ da escala salva: escalado para trabalhar no dia e sem falta, atestado, férias ou folga lançados (a exceção lançada na escala vence). */
export async function getBankHoursOverview(user: CurrentUser, year: number): Promise<BankHoursOverview> {
  requireBankHours(user);
  const holidays = nationalHolidays(year);
  const todayKey = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  const [collaborators, notes] = await Promise.all([
    db.collaborator.findMany({
      where: { active: true },
      include: { turno: { include: { scheduleType: true } }, function: { select: { name: true } } },
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
        label: e.kind === "FERIADO" ? `Feriado trabalhado${e.holidayName ? ` — ${e.holidayName}` : ""}` : e.days >= 0 ? "Ajuste manual (crédito)" : "Ajuste manual (débito)",
        note: e.note,
        by: e.createdByName,
        removable: true,
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

  // Feriados já passados: quem estava escalado para trabalhar e ainda não ganhou o dia.
  const pastHolidays = holidays.filter((h) => h.date <= todayKey);
  const suggestions: BankHoursOverview["suggestions"] = [];
  const creditedBy = new Map<string, number>();
  for (const e of entries) if (e.kind === "FERIADO") creditedBy.set(entryKey(e.date), (creditedBy.get(entryKey(e.date)) ?? 0) + 1);

  if (pastHolidays.length > 0) {
    const noteRows = await db.scheduleDayNote.findMany({
      where: { date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      select: { collaboratorId: true, date: true, overrideStatus: true, status: true },
    });
    const noteByKey = new Map(noteRows.map((n) => [`${n.collaboratorId}|${localKey(n.date)}`, n]));
    for (const h of pastHolidays) {
      const [y, m, d] = h.date.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      const list: BankHoursOverview["suggestions"][number]["people"] = [];
      for (const c of collaborators) {
        if (c.admissionDate && c.admissionDate > date) continue;
        const note = noteByKey.get(`${c.id}|${h.date}`);
        const effective = note ? note.overrideStatus : getCollaboratorDayStatus(date, c);
        if (effective !== "TRABALHO") continue;
        if (note?.status === "BH_MAIS") continue; // já lançado como BH+ na escala
        if ((entriesBy.get(c.id) ?? []).some((e) => e.kind === "FERIADO" && entryKey(e.date) === h.date)) continue;
        list.push({ collaboratorId: c.id, name: c.name, turnoName: c.turno?.name ?? null });
      }
      if (list.length > 0) suggestions.push({ holiday: h, people: list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) });
    }
  }

  return {
    year,
    tableReady,
    holidays: holidays.map((h) => ({
      ...h,
      past: h.date <= todayKey,
      pendingCount: suggestions.find((s) => s.holiday.date === h.date)?.people.length ?? 0,
      creditedCount: creditedBy.get(h.date) ?? 0,
    })),
    suggestions,
    people,
  };
}

/** Credita 1 dia de folga a cada colaborador que trabalhou num feriado nacional. Não credita o mesmo feriado duas vezes para a mesma pessoa. */
export async function creditHolidayWork(user: CurrentUser, input: { dateKey: string; collaboratorIds: string[] }): Promise<{ created: number }> {
  requireBankHours(user);
  const holiday = holidayOn(input.dateKey);
  if (!holiday) throw new Error("Essa data não é feriado nacional.");
  if (input.collaboratorIds.length === 0) return { created: 0 };
  const valid = await db.collaborator.findMany({ where: { id: { in: input.collaboratorIds } }, select: { id: true } });
  const result = await db.bankHourEntry.createMany({
    data: valid.map((c) => ({
      collaboratorId: c.id,
      date: new Date(`${input.dateKey}T12:00:00Z`),
      days: 1,
      kind: "FERIADO",
      holidayName: holiday.name,
      dedupKey: `h:${c.id}:${input.dateKey}`,
      createdById: user.id,
      createdByName: user.name,
    })),
    skipDuplicates: true,
  });
  return { created: result.count };
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

/** Apaga um lançamento do banco (engano). O BH+/BH- da escala se desfaz na própria escala. */
export async function deleteBankEntry(user: CurrentUser, id: string) {
  requireBankHours(user);
  await db.bankHourEntry.deleteMany({ where: { id } });
}
