import { describe, expect, it } from "vitest";
import { formatFriendlyCode } from "./codes";

describe("formatFriendlyCode", () => {
  it("preenche com zeros à esquerda até o número de dígitos padrão", () => {
    expect(formatFriendlyCode("NC", 1)).toBe("NC-000001");
    expect(formatFriendlyCode("EXE", 287)).toBe("EXE-000287");
  });

  it("respeita uma quantidade customizada de dígitos", () => {
    expect(formatFriendlyCode("PE", 3, 3)).toBe("PE-003");
  });
});
