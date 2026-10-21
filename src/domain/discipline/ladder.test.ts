import { describe, it, expect } from "vitest";
import { DISCIPLINE_STEPS, isChecklistInfraction, nextDisciplineStep } from "./ladder";

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

describe("isChecklistInfraction (menos de 80% do checklist)", () => {
  it("menos de 80% é ocorrência", () => {
    expect(isChecklistInfraction({ required: 30, doneOrJustified: 0 })).toBe(true);
    expect(isChecklistInfraction({ required: 18, doneOrJustified: 3 })).toBe(true);
    expect(isChecklistInfraction({ required: 30, doneOrJustified: 23 })).toBe(true); // 76,7%
  });
  it("80% ou mais cumpriu", () => {
    expect(isChecklistInfraction({ required: 30, doneOrJustified: 24 })).toBe(false); // 80%
    expect(isChecklistInfraction({ required: 30, doneOrJustified: 30 })).toBe(false);
    expect(isChecklistInfraction({ required: 10, doneOrJustified: 8 })).toBe(false);
    expect(isChecklistInfraction({ required: 10, doneOrJustified: 7 })).toBe(true);
  });
  it("sem equipamento exigido não há ocorrência", () => {
    expect(isChecklistInfraction({ required: 0, doneOrJustified: 0 })).toBe(false);
  });
});
