import { describe, expect, it } from "vitest";
import { greetingForHour } from "./greeting";

describe("greetingForHour", () => {
  it("bom dia, boa tarde e boa noite pelo horário", () => {
    expect(greetingForHour(5)).toBe("Bom dia");
    expect(greetingForHour(11)).toBe("Bom dia");
    expect(greetingForHour(12)).toBe("Boa tarde");
    expect(greetingForHour(17)).toBe("Boa tarde");
    expect(greetingForHour(18)).toBe("Boa noite");
    expect(greetingForHour(23)).toBe("Boa noite");
  });
  it("de madrugada é boa noite, não bom dia", () => {
    expect(greetingForHour(0)).toBe("Boa noite");
    expect(greetingForHour(4)).toBe("Boa noite");
  });
});
