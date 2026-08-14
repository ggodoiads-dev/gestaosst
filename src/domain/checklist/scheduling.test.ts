import { describe, expect, it } from "vitest";
import { getScheduledTimeForDate, computeDelayMinutes, isLate } from "./scheduling";

describe("getScheduledTimeForDate", () => {
  it("retorna o horário previsto todos os dias para periodicidade diária", () => {
    const schedule = { periodicity: "DIARIO" as const, timeOfDay: "07:00", daysOfWeek: null };
    const result = getScheduledTimeForDate(schedule, new Date("2026-08-10T12:00:00"));

    expect(result?.getHours()).toBe(7);
    expect(result?.getMinutes()).toBe(0);
  });

  it("só gera ocorrência nos dias da semana configurados para periodicidade semanal", () => {
    const schedule = { periodicity: "SEMANAL" as const, timeOfDay: "08:00", daysOfWeek: "1,3,5" }; // seg, qua, sex
    const monday = new Date("2026-08-10T00:00:00"); // segunda-feira
    const tuesday = new Date("2026-08-11T00:00:00"); // terça-feira

    expect(getScheduledTimeForDate(schedule, monday)).not.toBeNull();
    expect(getScheduledTimeForDate(schedule, tuesday)).toBeNull();
  });

  it("só gera ocorrência nos dias do mês configurados para periodicidade mensal", () => {
    const schedule = { periodicity: "MENSAL" as const, timeOfDay: "09:00", daysOfWeek: "1,15" };

    expect(getScheduledTimeForDate(schedule, new Date("2026-08-01T00:00:00"))).not.toBeNull();
    expect(getScheduledTimeForDate(schedule, new Date("2026-08-02T00:00:00"))).toBeNull();
    expect(getScheduledTimeForDate(schedule, new Date("2026-08-15T00:00:00"))).not.toBeNull();
  });
});

describe("computeDelayMinutes", () => {
  it("calcula o atraso em minutos entre o previsto e o realizado (seção 27)", () => {
    const scheduledFor = new Date("2026-08-07T07:00:00");
    const finishedAt = new Date("2026-08-07T07:35:00");

    expect(computeDelayMinutes(scheduledFor, finishedAt)).toBe(35);
  });

  it("nunca retorna atraso negativo quando finalizado antes do previsto", () => {
    const scheduledFor = new Date("2026-08-07T07:00:00");
    const finishedAt = new Date("2026-08-07T06:50:00");

    expect(computeDelayMinutes(scheduledFor, finishedAt)).toBe(0);
  });

  it("retorna null quando não há horário previsto", () => {
    expect(computeDelayMinutes(null, new Date())).toBeNull();
  });
});

describe("isLate", () => {
  it("considera atrasado quando o horário atual passou do previsto", () => {
    const scheduledFor = new Date("2026-08-07T07:00:00");
    const now = new Date("2026-08-07T07:01:00");

    expect(isLate(scheduledFor, now)).toBe(true);
  });

  it("não considera atrasado antes do horário previsto", () => {
    const scheduledFor = new Date("2026-08-07T07:00:00");
    const now = new Date("2026-08-07T06:59:00");

    expect(isLate(scheduledFor, now)).toBe(false);
  });
});
