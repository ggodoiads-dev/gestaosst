/** Regras puras dos desligamentos: classificação do motivo, chave contra duplicidade, tempo de casa e taxa de turnover. */

export type TerminationKind = "VOLUNTARIO" | "INVOLUNTARIO" | "ACORDO" | "OUTRO" | "FORA_TURNOVER" | "NAO_CLASSIFICADO";

export const TERMINATION_KIND_LABEL: Record<TerminationKind, string> = {
  VOLUNTARIO: "Pedido de demissão",
  INVOLUNTARIO: "Iniciativa da empresa",
  ACORDO: "Acordo",
  OUTRO: "Outro (aposentadoria, transferência, falecimento)",
  FORA_TURNOVER: "Fora do turnover (redução de QLP, transferência para cliente não monitorado)",
  NAO_CLASSIFICADO: "Sem classificação",
};

const squash = (s: string) =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => ch.codePointAt(0)! < 0x300)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Conta no turnover? Redução de QLP e transferência para cliente não monitorado ficam de fora. */
export function countsAsTurnover(kind: TerminationKind): boolean {
  return kind !== "FORA_TURNOVER";
}

/** Tipo efetivo de um desligamento já guardado: relê o motivo, para que quem entrou antes da classe "fora do turnover" também seja reclassificado sem mexer no banco. */
export function effectiveKind(storedKind: string, reason: string | null): TerminationKind {
  const reread = classifyTermination(null, reason);
  return reread === "FORA_TURNOVER" ? reread : (storedKind as TerminationKind);
}

/** Lê o tipo e o motivo do desligamento como escritos na planilha e decide a classe. Sem pista clara, fica "sem classificação" (nunca chuta). */
export function classifyTermination(kindText: string | null, reasonText: string | null): TerminationKind {
  const t = squash(`${kindText ?? ""} ${reasonText ?? ""}`);
  if (t === "") return "NAO_CLASSIFICADO";
  // Saídas que não são turnover: redução de QLP (quadro) e transferência para cliente não monitorado. Vêm antes de tudo, porque a planilha costuma
  // trazê-las como "iniciativa da empresa".
  if (t.includes("qlp") || t.includes("reducaodequadro") || t.includes("clientenaomonitorado") || (t.includes("transfer") && t.includes("naomonitorado"))) return "FORA_TURNOVER";
  // "involuntario" contém "voluntario": testar primeiro.
  if (t.includes("involuntari")) return "INVOLUNTARIO";
  if (t.includes("voluntari") || t.includes("pedido") || t.includes("pediu") || t.includes("iniciativadocolaborador") || t.includes("iniciativadoempregado")) return "VOLUNTARIO";
  if (t.includes("acordo") || t.includes("484")) return "ACORDO";
  if (t.includes("falecimento") || t.includes("obito") || t.includes("aposentadoria") || t.includes("transferencia")) return "OUTRO";
  if (t.includes("semjustacausa") || t.includes("justacausa") || t.includes("termino") || t.includes("fimdecontrato") || t.includes("experiencia") || t.includes("dispensa") || t.includes("iniciativadaempresa") || t.includes("empresa")) return "INVOLUNTARIO";
  return "NAO_CLASSIFICADO";
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Chave que impede o mesmo desligamento de entrar duas vezes (reimportar a planilha não duplica): matrícula (ou nome) + data. */
export function terminationKey(matricula: string | null, name: string, terminationDate: Date): string {
  const who = matricula && matricula.trim() !== "" ? `m:${squash(matricula)}` : `n:${squash(name)}`;
  return `${who}|${isoDay(terminationDate)}`;
}

export type TenureBucket = "ATE_90" | "91_180" | "181_365" | "MAIS_1_ANO" | "SEM_DATA";

export const TENURE_BUCKET_LABEL: Record<TenureBucket, string> = {
  ATE_90: "Até 90 dias",
  "91_180": "91 a 180 dias",
  "181_365": "181 a 365 dias",
  MAIS_1_ANO: "Mais de 1 ano",
  SEM_DATA: "Sem data de admissão",
};

export function tenureDays(admission: Date | null, termination: Date): number | null {
  if (!admission) return null;
  const days = Math.round((termination.getTime() - admission.getTime()) / 86400000);
  return days < 0 ? null : days;
}

export function tenureBucket(days: number | null): TenureBucket {
  if (days === null) return "SEM_DATA";
  if (days <= 90) return "ATE_90";
  if (days <= 180) return "91_180";
  if (days <= 365) return "181_365";
  return "MAIS_1_ANO";
}

/** Quantas pessoas estavam na casa em `at`: admitidas até o dia e ainda não desligadas. Sem data de admissão conta como já presente. */
export function headcountAt(people: { admissionDate: Date | null; inactivatedAt: Date | null }[], at: Date): number {
  return people.filter((p) => (!p.admissionDate || p.admissionDate <= at) && (!p.inactivatedAt || p.inactivatedAt > at)).length;
}

/** Turnover do período (%) = desligamentos ÷ média do efetivo no início e no fim. `null` quando não há base. */
export function turnoverRate(exits: number, headcountStart: number, headcountEnd: number): number | null {
  const avg = (headcountStart + headcountEnd) / 2;
  if (avg <= 0) return null;
  return Math.round((exits / avg) * 1000) / 10;
}
