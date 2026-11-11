import { describe, it, expect } from "vitest";
import { isHeldForRelease, statusAfterChecklist } from "./equipment-status-guard";

describe("checklist nunca libera equipamento sozinho", () => {
  it("em manutenção ou bloqueado, o checklist limpo não muda nada", () => {
    expect(statusAfterChecklist("EM_MANUTENCAO", "LIBERADO")).toBe("EM_MANUTENCAO");
    expect(statusAfterChecklist("BLOQUEADO", "LIBERADO")).toBe("BLOQUEADO");
    expect(statusAfterChecklist("EM_MANUTENCAO", "LIBERADO_COM_OBSERVACAO")).toBe("EM_MANUTENCAO");
  });
  it("restrito não vira liberado por checklist, mas pode piorar para bloqueado", () => {
    expect(statusAfterChecklist("RESTRITO", "LIBERADO")).toBe("RESTRITO");
    expect(statusAfterChecklist("RESTRITO", "LIBERADO_COM_OBSERVACAO")).toBe("RESTRITO");
    expect(statusAfterChecklist("RESTRITO", "BLOQUEADO")).toBe("BLOQUEADO");
  });
  it("liberado pode piorar normalmente", () => {
    expect(statusAfterChecklist("LIBERADO", "BLOQUEADO")).toBe("BLOQUEADO");
    expect(statusAfterChecklist("LIBERADO", "RESTRITO")).toBe("RESTRITO");
    expect(statusAfterChecklist("LIBERADO", "LIBERADO")).toBe("LIBERADO");
    expect(statusAfterChecklist("LIBERADO_COM_OBSERVACAO", "LIBERADO")).toBe("LIBERADO");
  });
  it("retido = bloqueado ou em manutenção", () => {
    expect(isHeldForRelease("EM_MANUTENCAO")).toBe(true);
    expect(isHeldForRelease("BLOQUEADO")).toBe(true);
    expect(isHeldForRelease("RESTRITO")).toBe(false);
  });
});
