/**
 * Matriz de função / multiskill: o nível de cada pessoa em cada atividade (0 a 4). Aderência = quantas atividades a pessoa executa sozinha ou ensina, entre
 * as que foram avaliadas; o nível vem da aderência. As mesmas regras da planilha de gestão do pipeline.
 */

export const SKILL_LEVELS = [
  { level: 0, emoji: "🔴", label: "Não conhece" },
  { level: 1, emoji: "🟡", label: "Em desenvolvimento" },
  { level: 2, emoji: "🟢", label: "Executa com apoio" },
  { level: 3, emoji: "⭐", label: "Executa sozinho" },
  { level: 4, emoji: "👑", label: "Pode ensinar" },
] as const;

export const levelLabel = (level: number | null | undefined) => SKILL_LEVELS.find((l) => l.level === level)?.label ?? "Não avaliado";
export const levelEmoji = (level: number | null | undefined) => SKILL_LEVELS.find((l) => l.level === level)?.emoji ?? "";

export type AdherenceLevel = "BASICO" | "INTERMEDIARIO" | "AVANCADO";
export const ADHERENCE_LABEL: Record<AdherenceLevel, string> = { BASICO: "Básico", INTERMEDIARIO: "Intermediário", AVANCADO: "Avançado" };

/** Executa sozinho (3) ou pode ensinar (4) conta como dominado. */
export const isMastered = (level: number) => level >= 3;

/** Aderência de uma pessoa (0 a 1): atividades dominadas ÷ atividades avaliadas. `null` se nada foi avaliado. */
export function adherence(levels: (number | null | undefined)[]): number | null {
  const rated = levels.filter((l): l is number => typeof l === "number");
  if (rated.length === 0) return null;
  return rated.filter(isMastered).length / rated.length;
}

/** Básico (menos de 40%), Intermediário (de 40% a menos de 70%) ou Avançado (70% ou mais). */
export function adherenceLevel(value: number | null): AdherenceLevel | null {
  if (value === null) return null;
  return value < 0.4 ? "BASICO" : value < 0.7 ? "INTERMEDIARIO" : "AVANCADO";
}

export type MatrixMemberData = { id: string; levels: Record<string, number> };

/** Por atividade: % das pessoas avaliadas que dominam. Por pessoa: aderência e nível. Geral: média das aderências (como a planilha: média das linhas preenchidas). */
export function matrixStats(skillIds: string[], members: MatrixMemberData[]) {
  const bySkill = skillIds.map((skillId) => {
    const rated = members.map((m) => m.levels[skillId]).filter((l): l is number => typeof l === "number");
    return { skillId, rated: rated.length, value: rated.length ? rated.filter(isMastered).length / rated.length : null };
  });
  const byMember = members.map((m) => {
    const value = adherence(skillIds.map((id) => m.levels[id]));
    return { memberId: m.id, value, level: adherenceLevel(value) };
  });
  const values = byMember.map((m) => m.value).filter((v): v is number => v !== null);
  return { bySkill, byMember, average: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null };
}

/** Lê o texto de uma célula da planilha ("⭐ Executa sozinho", "executa sozinho"...). Devolve o nível ou `null` se estiver vazio/desconhecido. */
export function parseLevel(text: string | null | undefined): number | null {
  const t = String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!t.trim()) return null;
  if (t.includes("ensinar")) return 4;
  if (t.includes("sozinho")) return 3;
  if (t.includes("apoio")) return 2;
  if (t.includes("desenvolv")) return 1;
  if (t.includes("nao conhece")) return 0;
  return null;
}

// ── Especialistas de função ──

export const SPECIALIST_GROUPS = ["Operador educador", "Campeão de Segurança", "Motorista educador", "Padrinho", "Líder operacional"] as const;
