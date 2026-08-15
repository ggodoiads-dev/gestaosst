import { describe, expect, it } from "vitest";
import {
  getDayStatus,
  getCollaboratorDayStatus,
  cycleStartFromFirstRestDay,
  isSecondRestDayConsistent,
} from "./schedule-calendar";

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

describe("getCollaboratorDayStatus", () => {
  it("usa a data pessoal (scheduleStartDate) quando definida, ignorando a do turno", () => {
    const turnoStart = new Date("2026-08-01T00:00:00");
    const personalStart = new Date("2026-08-04T00:00:00");
    const collaborator = {
      scheduleStartDate: personalStart,
      turno: { startDate: turnoStart, scheduleType: { workDays: 6, restDays: 2 } },
    };
    // dia 1 do ciclo pessoal é trabalho, mesmo que pro turno compartilhado esse dia já fosse folga
    expect(getCollaboratorDayStatus(personalStart, collaborator)).toBe("TRABALHO");
  });

  it("cai pra data do turno quando não há data pessoal definida", () => {
    const turnoStart = new Date("2026-08-01T00:00:00");
    const collaborator = {
      scheduleStartDate: null,
      turno: { startDate: turnoStart, scheduleType: { workDays: 6, restDays: 2 } },
    };
    expect(getCollaboratorDayStatus(turnoStart, collaborator)).toBe("TRABALHO");
  });

  it("retorna FOLGA quando o colaborador não tem turno", () => {
    expect(getCollaboratorDayStatus(new Date("2026-08-01T00:00:00"), { turno: null })).toBe("FOLGA");
  });
});

describe("cycleStartFromFirstRestDay", () => {
  it("calcula o dia 1 do ciclo subtraindo os dias de trabalho do 1º dia de folga", () => {
    const firstRestDay = new Date("2026-08-07T00:00:00"); // 6x1: folga no 7º dia
    const start = cycleStartFromFirstRestDay(firstRestDay, 6);
    expect(getDayStatus(new Date("2026-08-01T00:00:00"), start, 6, 1)).toBe("TRABALHO");
    expect(getDayStatus(firstRestDay, start, 6, 1)).toBe("FOLGA");
  });
});

describe("isSecondRestDayConsistent", () => {
  it("exige dias consecutivos quando restDays >= 2", () => {
    const first = new Date("2026-08-07T00:00:00");
    const consecutive = new Date("2026-08-08T00:00:00");
    const notConsecutive = new Date("2026-08-09T00:00:00");
    expect(isSecondRestDayConsistent(first, consecutive, 5, 2)).toBe(true);
    expect(isSecondRestDayConsistent(first, notConsecutive, 5, 2)).toBe(false);
  });

  it("exige o mesmo dia de folga no próximo ciclo quando restDays === 1", () => {
    const first = new Date("2026-08-07T00:00:00");
    const nextCycle = new Date("2026-08-14T00:00:00"); // 7 dias depois (6x1)
    const wrong = new Date("2026-08-08T00:00:00");
    expect(isSecondRestDayConsistent(first, nextCycle, 6, 1)).toBe(true);
    expect(isSecondRestDayConsistent(first, wrong, 6, 1)).toBe(false);
  });
});
