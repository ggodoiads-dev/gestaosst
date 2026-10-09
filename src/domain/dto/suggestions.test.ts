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
