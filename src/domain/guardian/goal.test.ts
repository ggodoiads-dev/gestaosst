import { describe, it, expect } from "vitest";
import { goalProgress, RISK_ACT_GOAL_PER_PERSON } from "./goal";

describe("meta de relatos de ato inseguro", () => {
  it("a meta é 2 por pessoa", () => {
    expect(RISK_ACT_GOAL_PER_PERSON).toBe(2);
  });
  it("conta quem bateu e limita cada pessoa à meta", () => {
    const p = goalProgress([{ count: 0 }, { count: 1 }, { count: 2 }, { count: 5 }]);
    expect(p.reached).toBe(2);
    expect(p.reachedPct).toBe(50);
    expect(p.counted).toBe(0 + 1 + 2 + 2);
    expect(p.expected).toBe(8);
    expect(p.coveragePct).toBe(63);
  });
  it("sem ninguém, tudo zero", () => {
    expect(goalProgress([])).toMatchObject({ people: 0, reached: 0, reachedPct: 0, expected: 0, coveragePct: 0 });
  });
});
