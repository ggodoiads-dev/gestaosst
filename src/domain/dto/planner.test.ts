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

  it("incidente libera o DTO mesmo dentro dos 60 dias e vem na frente de todos", () => {
    const plan = planDtoCalendar({
      fromKey: "2026-10-12",
      toKey: "2026-10-12",
      perDay: 1,
      people: [
        person("novo", { admissionDate: noon("2026-09-20") }),
        person("acidentado", { lastEffective: noon("2026-10-01"), incidentDate: noon("2026-10-08") }),
      ],
    });
    expect(plan.get("2026-10-12")![0]).toMatchObject({ id: "acidentado", kind: "incidente" });
  });

  it("incidente já atendido por um DTO depois dele não libera de novo", () => {
    const plan = planDtoCalendar({
      fromKey: "2026-10-12",
      toKey: "2026-10-12",
      perDay: 5,
      people: [person("atendido", { lastEffective: noon("2026-10-09"), incidentDate: noon("2026-10-08") })],
    });
    expect(plan.get("2026-10-12")).toEqual([]);
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

import { assignLeaders, leaderCovers, type PlannerLeader } from "./planner";

function leader(id: string, over: Partial<PlannerLeader> = {}): PlannerLeader {
  return { id, name: id, ownCollaboratorId: null, areaIds: new Set(), turnoIds: new Set(), collaboratorIds: new Set(), works: () => true, ...over };
}

describe("lideranças", () => {
  const person = { id: "p1", areaId: "areaA", turnoId: "t1" };

  it("cobre por área, respeitando os turnos do líder quando ele tem", () => {
    expect(leaderCovers(leader("l", { areaIds: new Set(["areaA"]) }), person)).toBe(true);
    expect(leaderCovers(leader("l", { areaIds: new Set(["areaA"]), turnoIds: new Set(["t2"]) }), person)).toBe(false);
    expect(leaderCovers(leader("l", { areaIds: new Set(["areaA"]), turnoIds: new Set(["t1"]) }), person)).toBe(true);
    expect(leaderCovers(leader("l", { areaIds: new Set(["areaB"]) }), person)).toBe(false);
  });

  it("cobre pessoa escolhida a dedo, mas nunca a si mesmo", () => {
    expect(leaderCovers(leader("l", { collaboratorIds: new Set(["p1"]) }), person)).toBe(true);
    expect(leaderCovers(leader("l", { areaIds: new Set(["areaA"]), ownCollaboratorId: "p1" }), person)).toBe(false);
  });

  it("distribui a carga entre as lideranças e respeita quem trabalha no dia", () => {
    const plan = new Map([["2026-10-12", [{ id: "p1", kind: "tempo" as const, tenureDays: null, daysSince: 90, incidentDate: null }, { id: "p2", kind: "tempo" as const, tenureDays: null, daysSince: 80, incidentDate: null }]]]);
    const persons = new Map([
      ["p1", { id: "p1", areaId: "areaA", turnoId: null }],
      ["p2", { id: "p2", areaId: "areaA", turnoId: null }],
    ]);
    const leaders = [leader("ana", { areaIds: new Set(["areaA"]) }), leader("bia", { areaIds: new Set(["areaA"]) }), leader("folga", { areaIds: new Set(["areaA"]), works: () => false })];
    const result = assignLeaders(plan, persons, leaders);
    expect([result.get("2026-10-12|p1")?.id, result.get("2026-10-12|p2")?.id].sort()).toEqual(["ana", "bia"]);
  });

  it("avaliador do quadro ADM cobre qualquer pessoa, menos ele mesmo", () => {
    const adm = leader("adm", { coversAll: true, ownCollaboratorId: "p1" });
    expect(leaderCovers(adm, { id: "p9", areaId: "qualquer", turnoId: null })).toBe(true);
    expect(leaderCovers(adm, { id: "p1", areaId: "areaA", turnoId: null })).toBe(false);
  });

  it("sem liderança que sirva, fica sem líder", () => {
    const plan = new Map([["2026-10-12", [{ id: "p1", kind: "nunca" as const, tenureDays: null, daysSince: null, incidentDate: null }]]]);
    const result = assignLeaders(plan, new Map([["p1", { id: "p1", areaId: "areaX", turnoId: null }]]), [leader("ana", { areaIds: new Set(["areaA"]) })]);
    expect(result.get("2026-10-12|p1")).toBeNull();
  });
});
