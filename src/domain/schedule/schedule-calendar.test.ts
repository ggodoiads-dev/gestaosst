import { describe, expect, it } from "vitest";
import { getDayStatus } from "./schedule-calendar";

describe("getDayStatus", () => {
  it("o dia exato do início do ciclo é trabalho", () => {
    const start = new Date("2026-08-01T00:00:00");
    expect(getDayStatus(start, start, 6, 2)).toBe("TRABALHO");
  });

  it("cobre um ciclo completo de 6x2 (6 dias trabalho, 2 dias folga)", () => {
    const start = new Date("2026-08-01T00:00:00"); // sábado, dia 1 do ciclo
    const expected = ["TRABALHO", "TRABALHO", "TRABALHO", "TRABALHO", "TRABALHO", "TRABALHO", "FOLGA", "FOLGA"];

    for (let i = 0; i < expected.length; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      expect(getDayStatus(date, start, 6, 2)).toBe(expected[i]);
    }
  });

  it("o ciclo se repete após o primeiro período completo", () => {
    const start = new Date("2026-08-01T00:00:00");
    const dayNine = new Date("2026-08-09T00:00:00"); // início do 2º ciclo (dia 8 do índice 0)
    expect(getDayStatus(dayNine, start, 6, 2)).toBe("TRABALHO");
  });

  it("funciona para datas anteriores ao início do ciclo", () => {
    const start = new Date("2026-08-10T00:00:00");
    const before = new Date("2026-08-09T00:00:00"); // 1 dia antes = último dia de folga do ciclo anterior
    expect(getDayStatus(before, start, 6, 2)).toBe("FOLGA");
  });

  it("funciona para escala 5x2", () => {
    const start = new Date("2026-08-03T00:00:00"); // segunda-feira
    const saturday = new Date("2026-08-08T00:00:00");
    const sunday = new Date("2026-08-09T00:00:00");
    expect(getDayStatus(saturday, start, 5, 2)).toBe("FOLGA");
    expect(getDayStatus(sunday, start, 5, 2)).toBe("FOLGA");
  });
});
