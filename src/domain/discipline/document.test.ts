import { describe, it, expect } from "vitest";
import { buildMeasureDocumentContent, stepHasDocument } from "./document";

const base = {
  reason: "CHECKLIST" as const,
  collaborator: { name: "FULANO DE TAL", matricula: "123", functionName: "Amarrador de carga", areaName: "Armazém racks" },
  occurrenceDate: "22/10/2026",
  sequence: 1,
  note: null,
  issuedAt: "23/10/2026",
};

describe("stepHasDocument", () => {
  it("o comitê não gera documento", () => {
    expect(stepHasDocument("COMITE")).toBe(false);
  });
  it("DTO, advertências e suspensões geram", () => {
    for (const s of ["DTO_1", "DTO_2", "ADV_VERBAL", "ADV_ESCRITA_1", "ADV_ESCRITA_2", "SUSPENSAO_1", "SUSPENSAO_3"]) expect(stepHasDocument(s)).toBe(true);
  });
});

describe("buildMeasureDocumentContent", () => {
  it("DTO é registro de orientação, sem tom de penalidade", () => {
    const doc = buildMeasureDocumentContent({ ...base, step: "DTO_1", sequence: 1 });
    expect(doc.title).toBe("REGISTRO DE ORIENTAÇÃO — 1º DTO");
    expect(doc.paragraphs.join(" ")).toContain("não constitui penalidade");
    expect(doc.paragraphs.join(" ")).not.toContain("art. 482");
    expect(doc.isSuspension).toBe(false);
  });
  it("advertência escrita cita o fato, a medida e a sequência", () => {
    const doc = buildMeasureDocumentContent({ ...base, step: "ADV_ESCRITA_2", sequence: 5 });
    expect(doc.title).toBe("ADVERTÊNCIA ESCRITA — 2ª");
    expect(doc.paragraphs[0]).toContain("22/10/2026");
    expect(doc.paragraphs[0]).toContain("checklist");
    expect(doc.paragraphs[1]).toContain("5ª medida");
    expect(doc.isSuspension).toBe(false);
  });
  it("suspensão traz o período em branco e os dias", () => {
    const doc = buildMeasureDocumentContent({ ...base, reason: "FALTA", step: "SUSPENSAO_3", sequence: 7 });
    expect(doc.isSuspension).toBe(true);
    expect(doc.paragraphs.join(" ")).toContain("3 (três) dias");
    expect(doc.paragraphs.join(" ")).toContain("____/____/________");
    expect(doc.paragraphs[0]).toContain("falta injustificada");
  });
});
