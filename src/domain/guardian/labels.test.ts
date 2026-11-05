import { describe, it, expect } from "vitest";
import { guardianTypeShares } from "./labels";

describe("guardianTypeShares", () => {
  it("calcula o percentual de cada tipo sobre o total e inclui os tipos zerados", () => {
    const shares = guardianTypeShares([
      { type: "COMPORTAMENTO_RISCO", count: 1 },
      { type: "RECONHECIMENTO", count: 3 },
    ]);
    expect(shares).toHaveLength(4);
    expect(shares.find((s) => s.type === "RECONHECIMENTO")?.pct).toBe(75);
    expect(shares.find((s) => s.type === "COMPORTAMENTO_RISCO")?.pct).toBe(25);
    expect(shares.find((s) => s.type === "INCIDENTE")?.pct).toBe(0);
  });
  it("sem relatos, tudo zero (sem divisão por zero)", () => {
    expect(guardianTypeShares([]).every((s) => s.pct === 0 && s.count === 0)).toBe(true);
  });
});
