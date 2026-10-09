import { describe, it, expect } from "vitest";
import { parseDeadlineDays } from "./deadline";

describe("parseDeadlineDays", () => {
  it("entende os prazos que o Rico costuma dar", () => {
    expect(parseDeadlineDays("Imediato")).toBe(2);
    expect(parseDeadlineDays("7 dias")).toBe(7);
    expect(parseDeadlineDays("30 dias")).toBe(30);
    expect(parseDeadlineDays("2 semanas")).toBe(14);
    expect(parseDeadlineDays("1 mês")).toBe(30);
  });

  it("sem prazo reconhecível usa o padrão", () => {
    expect(parseDeadlineDays("—")).toBe(14);
    expect(parseDeadlineDays("")).toBe(14);
  });
});
