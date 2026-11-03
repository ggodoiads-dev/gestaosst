import { describe, expect, it } from "vitest";
import { buildPresence, lastClosedMonth, presenceAt, windowIsCovered } from "./presence";

const d = (y: number, m: number, day = 1) => new Date(y, m - 1, day);

describe("buildPresence", () => {
  it("ativo sem datas conta como presente", () => {
    const { people, unplaced } = buildPresence([{ id: "a", active: true, admissionDate: null, inactivatedAt: null }], []);
    expect(unplaced).toBe(0);
    expect(presenceAt(people, d(2026, 5))).toBe(1);
  });

  it("inativo sem data de saída fica fora (não infla o efetivo do passado)", () => {
    const { people, unplaced } = buildPresence([{ id: "a", active: false, admissionDate: d(2025, 1), inactivatedAt: null }], []);
    expect(unplaced).toBe(1);
    expect(people).toHaveLength(0);
  });

  it("usa a data do desligamento importado quando o cadastro não tem", () => {
    const { people } = buildPresence(
      [{ id: "a", active: true, admissionDate: d(2025, 1), inactivatedAt: null }],
      [{ collaboratorId: "a", admissionDate: null, terminationDate: d(2026, 3, 10) }],
    );
    expect(presenceAt(people, d(2026, 2))).toBe(1);
    expect(presenceAt(people, d(2026, 4))).toBe(0);
  });

  it("quem saiu e não está no cadastro estava na casa até a saída", () => {
    const { people } = buildPresence([], [{ collaboratorId: null, admissionDate: d(2025, 6), terminationDate: d(2026, 2, 15) }]);
    expect(presenceAt(people, d(2025, 5))).toBe(0);
    expect(presenceAt(people, d(2025, 12))).toBe(1);
    expect(presenceAt(people, d(2026, 3))).toBe(0);
  });

  it("saída anterior à admissão (readmitido) não derruba quem está ativo", () => {
    const { people } = buildPresence(
      [{ id: "a", active: true, admissionDate: d(2026, 1), inactivatedAt: null }],
      [{ collaboratorId: "a", admissionDate: d(2024, 1), terminationDate: d(2025, 6) }],
    );
    expect(presenceAt(people, d(2026, 6))).toBe(1);
  });
});

describe("meses fechados e cobertura", () => {
  it("só conta mês fechado", () => {
    expect(lastClosedMonth(2025, new Date(2026, 10, 3))).toBe(11);
    expect(lastClosedMonth(2026, new Date(2026, 10, 3))).toBe(9);
    expect(lastClosedMonth(2026, new Date(2026, 0, 20))).toBe(-1);
    expect(lastClosedMonth(2027, new Date(2026, 10, 3))).toBe(-1);
  });

  it("janela sem histórico importado não é calculada", () => {
    expect(windowIsCovered(d(2025, 11), d(2025, 3, 20))).toBe(true);
    expect(windowIsCovered(d(2025, 1), d(2025, 3, 20))).toBe(false);
    expect(windowIsCovered(d(2025, 1), null)).toBe(false);
  });
});
