import { describe, expect, it } from "vitest";
import { interviewDiagnosis, sanitizeRatings, summarizeInterviews, type InterviewLite } from "./interview";

const iv = (primary: string, extra: Partial<InterviewLite> = {}): InterviewLite => ({ primaryReason: primary, secondaryReasons: [], ratings: {}, wouldReturn: null, ...extra });

describe("sanitizeRatings", () => {
  it("só aceita notas inteiras de 1 a 5", () => {
    expect(sanitizeRatings({ lideranca: 4, salario: 0, beneficios: 6, ambiente: 3.5, treinamento: "5", extra: 5 })).toEqual({ lideranca: 4 });
    expect(sanitizeRatings(null)).toEqual({});
  });
});

describe("summarizeInterviews", () => {
  const list = [
    iv("SALARIO", { secondaryReasons: ["LIDERANCA"], ratings: { lideranca: 2, salario: 1 }, wouldReturn: "NAO" }),
    iv("SALARIO", { ratings: { lideranca: 4, salario: 2 }, wouldReturn: "SIM" }),
    iv("LIDERANCA", { secondaryReasons: ["SALARIO"], ratings: { lideranca: 3 }, wouldReturn: "TALVEZ" }),
  ];
  const s = summarizeInterviews(list);
  it("conta o motivo principal e as menções", () => {
    expect(s.count).toBe(3);
    expect(s.primary[0]).toMatchObject({ key: "SALARIO", count: 2, pct: 67 });
    expect(s.mentions.find((m) => m.key === "SALARIO")?.count).toBe(3);
    expect(s.mentions.find((m) => m.key === "LIDERANCA")?.count).toBe(2);
  });
  it("média das notas só entre quem respondeu", () => {
    expect(s.ratings.find((r) => r.key === "lideranca")).toMatchObject({ avg: 3, n: 3 });
    expect(s.ratings.find((r) => r.key === "salario")).toMatchObject({ avg: 1.5, n: 2 });
    expect(s.ratings.find((r) => r.key === "ambiente")).toMatchObject({ avg: null, n: 0 });
  });
  it("percentual de quem voltaria", () => {
    expect(s.wouldReturnPct).toBe(33);
  });
});

describe("interviewDiagnosis", () => {
  it("avisa cobertura baixa", () => {
    const out = interviewDiagnosis(summarizeInterviews([iv("SALARIO")]), 10);
    expect(out[0]).toContain("Só 10%");
  });
  it("com 5 ou mais entrevistas aponta o motivo, a nota e a volta", () => {
    const list = Array.from({ length: 6 }, (_, k) => iv(k < 3 ? "SALARIO" : "CLIMA", { ratings: { salario: 2 }, wouldReturn: "NAO" }));
    const out = interviewDiagnosis(summarizeInterviews(list), 6);
    expect(out.some((l) => l.includes("Salário"))).toBe(true);
    expect(out.some((l) => l.includes("salário (nota média 2"))).toBe(true);
    expect(out.some((l) => l.includes("voltariam"))).toBe(true);
  });
});
