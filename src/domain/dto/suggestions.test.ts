import { describe, it, expect } from "vitest";
import { dtoCooldown } from "./suggestions";

const noon = (key: string) => new Date(`${key}T12:00:00Z`);

describe("dtoCooldown", () => {
  it("quem nunca foi avaliado é elegível", () => {
    expect(dtoCooldown(null, "2026-10-09")).toMatchObject({ daysSince: null, eligible: true, eligibleOn: null });
  });

  it("antes de 60 dias ainda está em carência e informa quando libera", () => {
    const r = dtoCooldown(noon("2026-08-20"), "2026-10-09");
    expect(r.daysSince).toBe(50);
    expect(r.eligible).toBe(false);
    expect(r.eligibleOn?.toISOString().slice(0, 10)).toBe("2026-10-19");
  });

  it("com exatamente 60 dias já pode ser avaliado de novo", () => {
    const r = dtoCooldown(noon("2026-08-10"), "2026-10-09");
    expect(r.daysSince).toBe(60);
    expect(r.eligible).toBe(true);
  });

  it("DTO antigo é elegível", () => {
    expect(dtoCooldown(noon("2025-07-30"), "2026-10-09").eligible).toBe(true);
  });
});

import { tenureDays } from "./suggestions";

describe("tenureDays", () => {
  it("conta os dias de casa", () => {
    expect(tenureDays(new Date("2026-09-01T00:00:00Z"), "2026-10-09")).toBe(38);
  });
  it("sem data de admissão não dá pra saber", () => {
    expect(tenureDays(null, "2026-10-09")).toBeNull();
  });
});

import { daysSinceDate } from "./suggestions";

describe("daysSinceDate", () => {
  it("conta dias entre a data do DTO e hoje", () => {
    expect(daysSinceDate(new Date("2026-08-04T12:00:00Z"), "2026-10-09")).toBe(66);
  });
});

import { hasPendingIncident } from "./suggestions";

describe("hasPendingIncident", () => {
  const inc = new Date("2026-10-05T12:00:00Z");
  it("sem incidente não há o que atender", () => {
    expect(hasPendingIncident(null, null)).toBe(false);
  });
  it("incidente sem nenhum DTO está pendente", () => {
    expect(hasPendingIncident(null, inc)).toBe(true);
  });
  it("DTO antes do incidente não resolve; no dia ou depois resolve", () => {
    expect(hasPendingIncident(new Date("2026-10-01T12:00:00Z"), inc)).toBe(true);
    expect(hasPendingIncident(new Date("2026-10-05T12:00:00Z"), inc)).toBe(false);
    expect(hasPendingIncident(new Date("2026-10-07T12:00:00Z"), inc)).toBe(false);
  });
});
