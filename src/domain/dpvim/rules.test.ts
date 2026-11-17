import { describe, it, expect } from "vitest";
import { dpvimSituation, dueAtFrom, formatHours, parseBrasiliaLocal, progressPercent } from "./rules";

const arrived = new Date("2026-11-10T12:00:00Z");

describe("prazo de 48h", () => {
  it("vence 48h depois da chegada", () => {
    expect(dueAtFrom(arrived).toISOString()).toBe("2026-11-12T12:00:00.000Z");
  });
  it("atrasada depois das 48h, vence logo nas últimas 12h, no prazo antes disso", () => {
    const due = dueAtFrom(arrived);
    const base = { status: "ABERTA" as const, dueAt: due, finishedAt: null };
    expect(dpvimSituation(base, new Date("2026-11-12T12:00:01Z")).situation).toBe("ATRASADA");
    expect(dpvimSituation(base, new Date("2026-11-12T00:00:00Z")).situation).toBe("VENCE_LOGO");
    expect(dpvimSituation(base, new Date("2026-11-11T00:00:00Z")).situation).toBe("NO_PRAZO");
    expect(dpvimSituation({ ...base, status: "EM_ANDAMENTO" }, new Date("2026-11-13T12:00:00Z")).hoursLeft).toBe(-24);
  });
  it("concluída: no prazo ou com atraso, pela hora em que acabou", () => {
    const due = dueAtFrom(arrived);
    expect(dpvimSituation({ status: "CONCLUIDA", dueAt: due, finishedAt: new Date("2026-11-12T11:59:00Z") }, new Date()).situation).toBe("CONCLUIDA_NO_PRAZO");
    expect(dpvimSituation({ status: "CONCLUIDA", dueAt: due, finishedAt: new Date("2026-11-12T13:00:00Z") }, new Date()).situation).toBe("CONCLUIDA_ATRASADA");
    expect(dpvimSituation({ status: "CANCELADA", dueAt: due, finishedAt: null }, new Date()).situation).toBe("CANCELADA");
  });
});

describe("formatos", () => {
  it("horas legíveis", () => {
    expect(formatHours(0.75)).toBe("45min");
    expect(formatHours(3.3333)).toBe("3h 20min");
    expect(formatHours(28)).toBe("1d 4h");
    expect(formatHours(-48)).toBe("2d");
  });
  it("data digitada em Brasília", () => {
    expect(parseBrasiliaLocal("2026-11-10T09:00")?.toISOString()).toBe("2026-11-10T12:00:00.000Z");
    expect(parseBrasiliaLocal("10/11/2026")).toBeNull();
  });
  it("progresso limitado a 100", () => {
    expect(progressPercent(210, 420)).toBe(50);
    expect(progressPercent(500, 420)).toBe(100);
    expect(progressPercent(5, 0)).toBe(0);
  });
});
