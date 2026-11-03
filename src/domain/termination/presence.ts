/**
 * Quem estava na casa em cada data, para o efetivo do turnover. Junta o cadastro de colaboradores com os desligamentos importados: o cadastro sozinho erra o efetivo
 * quando quem saiu continua ativo (ou foi inativado sem data), e quem saiu e nem está mais no cadastro some do passado.
 */
export type CollaboratorLite = { id: string; active: boolean; admissionDate: Date | null; inactivatedAt: Date | null };
export type TerminationLite = { collaboratorId: string | null; admissionDate: Date | null; terminationDate: Date };
export type Presence = { admissionDate: Date | null; departureDate: Date | null };

export function buildPresence(collaborators: CollaboratorLite[], terminations: TerminationLite[]): { people: Presence[]; unplaced: number } {
  // saída mais recente importada para cada colaborador do cadastro
  const exitOf = new Map<string, Date>();
  for (const t of terminations) {
    if (!t.collaboratorId) continue;
    const cur = exitOf.get(t.collaboratorId);
    if (!cur || t.terminationDate > cur) exitOf.set(t.collaboratorId, t.terminationDate);
  }
  const known = new Set(collaborators.map((c) => c.id));
  const people: Presence[] = [];
  let unplaced = 0;
  for (const c of collaborators) {
    const imported = exitOf.get(c.id) ?? null;
    // a saída importada só vale se vem depois da admissão (quem foi readmitido continua ativo com a admissão nova)
    const usable = imported && (!c.admissionDate || imported >= c.admissionDate) ? imported : null;
    const departure = c.inactivatedAt ?? usable;
    // inativo sem nenhuma data de saída: não dá para saber de quando a quando ele contou; fica fora do efetivo histórico
    if (!c.active && !departure) {
      unplaced++;
      continue;
    }
    people.push({ admissionDate: c.admissionDate, departureDate: departure });
  }
  // saiu e não está mais no cadastro: estava na casa até a saída
  for (const t of terminations) {
    if (t.collaboratorId && known.has(t.collaboratorId)) continue;
    people.push({ admissionDate: t.admissionDate, departureDate: t.terminationDate });
  }
  return { people, unplaced };
}

export function presenceAt(people: Presence[], at: Date): number {
  return people.filter((p) => (!p.admissionDate || p.admissionDate <= at) && (!p.departureDate || p.departureDate > at)).length;
}

/** Último mês JÁ FECHADO do ano (0 a 11), ou -1 se ainda não fechou nenhum (janeiro do ano corrente ou ano futuro). */
export function lastClosedMonth(year: number, now: Date): number {
  if (year < now.getFullYear()) return 11;
  if (year > now.getFullYear()) return -1;
  return now.getMonth() - 1;
}

/** A janela de 12 meses só é confiável se o histórico importado já existia quando ela começou. `firstExit` = data do desligamento mais antigo importado. */
export function windowIsCovered(windowStart: Date, firstExit: Date | null): boolean {
  if (!firstExit) return false;
  const first = new Date(firstExit.getFullYear(), firstExit.getMonth(), 1);
  return windowStart >= first;
}
