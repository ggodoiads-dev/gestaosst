import { DTO_NEW_HIRE_DAYS, dtoCooldown, tenureDays } from "./suggestions";

export type PlannerPerson = {
  id: string;
  name: string;
  admissionDate: Date | null;
  /** Último DTO ou justificativa (meio-dia UTC do dia). */
  lastEffective: Date | null;
  works: (dayKey: string) => boolean;
};

export type PlannedSlot = { id: string; kind: "novo" | "nunca" | "tempo"; tenureDays: number | null; daysSince: number | null };

function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n, 12));
  return date.toISOString().slice(0, 10);
}

function isWeekday(key: string): boolean {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Distribui os DTOs dia a dia de `fromKey` até `toKey` (só dias úteis): em cada dia pega até `perDay` pessoas que
 * trabalham nele e já cumpriram a carência de 60 dias. Quem é escalado ganha "DTO feito" naquele dia na simulação, então
 * não volta antes de 60 dias. Ordem: novos (< 60 dias de casa, os mais perto de completar 60 antes), nunca avaliados
 * (os mais antigos na casa antes) e quem está há mais tempo sem DTO.
 */
export function planDtoCalendar(args: { fromKey: string; toKey: string; perDay: number; people: PlannerPerson[] }): Map<string, PlannedSlot[]> {
  const plan = new Map<string, PlannedSlot[]>();
  const last = new Map(args.people.map((p) => [p.id, p.lastEffective]));

  for (let key = args.fromKey; key <= args.toKey; key = addDaysKey(key, 1)) {
    if (!isWeekday(key)) continue;
    const ranked = args.people
      .map((p) => {
        const cooldown = dtoCooldown(last.get(p.id) ?? null, key);
        const tenure = tenureDays(p.admissionDate, key);
        const isNew = tenure !== null && tenure >= 0 && tenure < DTO_NEW_HIRE_DAYS;
        const kind: PlannedSlot["kind"] = isNew ? "novo" : cooldown.daysSince === null ? "nunca" : "tempo";
        return { p, cooldown, tenure, kind };
      })
      .filter((x) => x.cooldown.eligible && x.p.works(key))
      .sort((a, b) => {
        const rank = (k: PlannedSlot["kind"]) => (k === "novo" ? 0 : k === "nunca" ? 1 : 2);
        if (rank(a.kind) !== rank(b.kind)) return rank(a.kind) - rank(b.kind);
        if (a.kind === "novo") return (b.tenure ?? 0) - (a.tenure ?? 0) || a.p.name.localeCompare(b.p.name, "pt-BR");
        if (a.kind === "nunca") {
          return (a.p.admissionDate?.getTime() ?? Infinity) - (b.p.admissionDate?.getTime() ?? Infinity) || a.p.name.localeCompare(b.p.name, "pt-BR");
        }
        return (b.cooldown.daysSince ?? 0) - (a.cooldown.daysSince ?? 0) || a.p.name.localeCompare(b.p.name, "pt-BR");
      })
      .slice(0, args.perDay);

    for (const x of ranked) last.set(x.p.id, new Date(`${key}T12:00:00Z`));
    plan.set(
      key,
      ranked.map((x) => ({ id: x.p.id, kind: x.kind, tenureDays: x.tenure, daysSince: x.cooldown.daysSince })),
    );
  }
  return plan;
}
