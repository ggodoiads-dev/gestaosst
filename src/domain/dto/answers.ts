export type DtoAnswer = { q: string; a: string };

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Sim / Não / N/A viram contagem; qualquer outro texto (observação, "Outros"...) é só resposta aberta. */
export function classifyAnswer(answer: string): "yes" | "no" | "na" | "text" {
  const n = normalizeText(answer);
  if (n === "sim") return "yes";
  if (n === "nao") return "no";
  if (n === "na" || n === "naoseaplica" || n === "naoaplicavel") return "na";
  return "text";
}

export function summarizeAnswers(answers: DtoAnswer[]) {
  let yes = 0;
  let no = 0;
  let na = 0;
  for (const { a } of answers) {
    const kind = classifyAnswer(a);
    if (kind === "yes") yes++;
    else if (kind === "no") no++;
    else if (kind === "na") na++;
  }
  const scored = yes + no;
  return { yes, no, na, scorePercent: scored === 0 ? null : Math.round((yes / scored) * 100) };
}

