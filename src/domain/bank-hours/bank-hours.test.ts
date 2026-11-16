import { describe, it, expect } from "vitest";
import { nationalHolidays, easterSunday, holidayOn } from "./holidays";
import { computeBalance } from "./balance";

describe("feriados nacionais", () => {
  it("Páscoa e Sexta-feira Santa", () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(nationalHolidays(2026).find((h) => h.name === "Sexta-feira Santa")?.date).toBe("2026-04-03");
    expect(nationalHolidays(2025).find((h) => h.name === "Sexta-feira Santa")?.date).toBe("2025-04-18");
  });
  it("lista de 2026 tem 10 feriados em ordem, com Consciência Negra", () => {
    const list = nationalHolidays(2026);
    expect(list).toHaveLength(10);
    expect(list.map((h) => h.date)).toEqual([...list.map((h) => h.date)].sort());
    expect(holidayOn("2026-11-20")?.name).toBe("Consciência Negra");
    expect(holidayOn("2026-11-15")?.name).toBe("Proclamação da República");
    expect(holidayOn("2026-11-16")).toBeNull();
  });
  it("antes de 2024 não tem Consciência Negra", () => {
    expect(nationalHolidays(2023)).toHaveLength(9);
  });
});

describe("saldo de banco de horas", () => {
  it("créditos menos folgas compensadas; devendo fica negativo", () => {
    expect(computeBalance([{ date: "2026-11-02", days: 1 }], [{ date: "2026-11-10", status: "BH_MENOS" }])).toEqual({ credits: 1, debits: 1, balance: 0 });
    expect(computeBalance([], [{ date: "2026-11-10", status: "BH_MENOS" }])).toEqual({ credits: 0, debits: 1, balance: -1 });
    expect(computeBalance([{ date: "2026-11-15", days: 1 }, { date: "2026-11-20", days: 1 }], [{ date: "2026-11-25", status: "BH_MENOS" }]).balance).toBe(1);
  });
  it("BH+ na escala conta, mas não repete o crédito do mesmo dia", () => {
    expect(computeBalance([], [{ date: "2026-11-01", status: "BH_MAIS" }]).balance).toBe(1);
    expect(computeBalance([{ date: "2026-11-02", days: 1 }], [{ date: "2026-11-02", status: "BH_MAIS" }]).balance).toBe(1);
  });
  it("ajuste manual fracionado e negativo", () => {
    expect(computeBalance([{ date: "2026-11-05", days: 0.5 }, { date: "2026-11-06", days: -1 }], []).balance).toBe(-0.5);
  });
});
