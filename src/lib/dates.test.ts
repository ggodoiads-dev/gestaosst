import { describe, expect, it } from "vitest";
import { formatDate, startOfTodayInAppTimezone } from "./dates";

describe("formatDate", () => {
  it("trata meia-noite UTC como data de calendário (o 'hoje' do servidor não vira ontem)", () => {
    expect(formatDate(new Date("2026-10-08T00:00:00.000Z"))).toBe("08/10/2026");
  });

  it("instante real continua sendo convertido pra Brasília", () => {
    expect(formatDate(new Date("2026-10-08T15:00:00.000Z"))).toBe("08/10/2026");
    // 02:00 UTC = 23:00 do dia anterior em Brasília
    expect(formatDate(new Date("2026-10-08T02:00:00.000Z"))).toBe("07/10/2026");
  });

  it("data guardada ao meio-dia (parseDateOnly) não muda de dia", () => {
    expect(formatDate(new Date("2026-08-12T12:00:00.000Z"))).toBe("12/08/2026");
  });
});

describe("startOfTodayInAppTimezone", () => {
  it("o dia de hoje começa às 03:00 UTC (meia-noite de Brasília)", () => {
    expect(startOfTodayInAppTimezone(new Date("2026-10-08T14:00:00.000Z")).toISOString()).toBe("2026-10-08T03:00:00.000Z");
  });

  it("às 22h de Brasília ainda é o dia que começou às 03:00 UTC daquele dia", () => {
    // 01:00 UTC do dia 8 = 22:00 do dia 7 em Brasília
    expect(startOfTodayInAppTimezone(new Date("2026-10-08T01:00:00.000Z")).toISOString()).toBe("2026-10-07T03:00:00.000Z");
  });
});
