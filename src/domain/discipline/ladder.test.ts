import { describe, it, expect } from "vitest";
import { DISCIPLINE_STEPS, isChecklistInfraction, isPartialChecklist, nextDisciplineStep } from "./ladder";

describe("nextDisciplineStep", () => {
  it("segue a ordem da escada", () => {
    expect(nextDisciplineStep(0)).toBe("DTO_1");
    expect(nextDisciplineStep(1)).toBe("DTO_2");
    expect(nextDisciplineStep(2)).toBe("ADV_VERBAL");
    expect(nextDisciplineStep(5)).toBe("SUSPENSAO_1");
    expect(nextDisciplineStep(6)).toBe("SUSPENSAO_3");
    expect(nextDisciplineStep(7)).toBe("COMITE");
  });
  it("depois do comitê fica no comitê", () => {
    expect(nextDisciplineStep(DISCIPLINE_STEPS.length)).toBe("COMITE");
    expect(nextDisciplineStep(50)).toBe("COMITE");
  });
});

describe("isChecklistInfraction", () => {
  it("só é ocorrência quando não fez nenhum equipamento", () => {
    expect(isChecklistInfraction({ required: 30, doneOrJustified: 0 })).toBe(true);
    expect(isChecklistInfraction({ required: 30, doneOrJustified: 1 })).toBe(false);
    expect(isChecklistInfraction({ required: 30, doneOrJustified: 29 })).toBe(false);
  });
  it("sem equipamento exigido não há ocorrência", () => {
    expect(isChecklistInfraction({ required: 0, doneOrJustified: 0 })).toBe(false);
  });
});

describe("isPartialChecklist", () => {
  it("fez alguns mas menos da metade = parcial (não é ocorrência automática)", () => {
    expect(isPartialChecklist({ required: 18, doneOrJustified: 3 })).toBe(true);
    expect(isPartialChecklist({ required: 18, doneOrJustified: 8 })).toBe(true);
  });
  it("metade ou mais = cumpriu; zero = ocorrência (não parcial)", () => {
    expect(isPartialChecklist({ required: 18, doneOrJustified: 9 })).toBe(false);
    expect(isPartialChecklist({ required: 18, doneOrJustified: 0 })).toBe(false);
  });
});
