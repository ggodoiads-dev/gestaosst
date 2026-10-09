import { describe, it, expect } from "vitest";
import { planDtoCalendar, type PlannerPerson } from "./planner";

const noon = (key: string) => new Date(`${key}T12:00:00Z`);
const always = () => true;

function person(id: string, over: Partial<PlannerPerson> = {}): PlannerPerson {
  return { id, name: id, admissionDate: noon("2020-01-01"), lastEffective: null, works: always, ...over };
}

describe("planDtoCalendar", () => {
  it("respeita a meta por dia e só usa dias úteis", () => {
    const plan = planDtoCalendar({ fromKey: "2026-10-09", toKey: "2026-10-13", perDay: 2, people: ["a", "b", "c", "d", "e"].map((id) => person(id)) });
    // 09/10/2026 é sexta; 10 e 11 são fim de semana; 12 e 13 são segunda e terça.
    expect([...plan.keys()]).toEqual(["2026-10-09", "2026-10-12", "2026-10-13"]);
    expect(plan.get("2026-10-09")).toHaveLength(2);
    expect(plan.get("2026-10-12")).toHaveLength(2);
    expect(plan.get("2026-10-13")).toHaveLength(1);
  });

  it("novos (menos de 60 dias de casa) vêm antes de quem nunca foi avaliado", () => {
    const plan = planDtoCalendar({
      fromKey: "2026-10-12",
      toKey: "2026-10-12",
      perDay: 1,
      people: [person("antigo"), person("novo", { admissionDate: noon("2026-09-20") })],
    });
    expect(plan.get("2026-10-12")![0]).toMatchObject({ id: "novo", kind: "novo" });
  });

  it("quem tem DTO há menos de 60 dias não entra, e quem entra não repete dentro de 60 dias", () => {
    const plan = planDtoCalendar({
      fromKey: "2026-10-12",
      toKey: "2026-10-23",
      perDay: 5,
      people: [person("recente", { lastEffective: noon("2026-09-30") }), person("livre")],
    });
    const allIds = [...plan.values()].flat().map((s) => s.id);
    expect(allIds).not.toContain("recente");
    expect(allIds.filter((id) => id === "livre")).toHaveLength(1);
  });

  it("só escala no dia em que a pessoa trabalha", () => {
    const plan = planDtoCalendar({
      fromKey: "2026-10-12",
      toKey: "2026-10-14",
      perDay: 1,
      people: [person("folguista", { works: (k) => k === "2026-10-14" })],
    });
    expect(plan.get("2026-10-12")).toEqual([]);
    expect(plan.get("2026-10-14")![0].id).toBe("folguista");
  });
});
