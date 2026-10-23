import { describe, expect, it } from "vitest";
import { contiguousEnd, contiguousStart, isValidVacation, vacationDayKeys, vacationRange } from "./vacation";

describe("férias em dias corridos", () => {
  it("30 dias a partir de 10/11 terminam em 09/12 e a volta é 10/12", () => {
    expect(vacationRange("2026-11-10", 30)).toEqual({ endKey: "2026-12-09", returnKey: "2026-12-10" });
    const keys = vacationDayKeys("2026-11-10", 30);
    expect(keys).toHaveLength(30);
    expect(keys[0]).toBe("2026-11-10");
    expect(keys[29]).toBe("2026-12-09");
  });
  it("atravessa a virada do ano e fevereiro", () => {
    expect(vacationRange("2026-12-20", 20).endKey).toBe("2027-01-08");
    expect(vacationRange("2028-02-20", 10).endKey).toBe("2028-02-29");
  });
  it("valida data e quantidade de dias", () => {
    expect(isValidVacation("2026-11-10", 30)).toBe(true);
    expect(isValidVacation("2026-11-10", 0)).toBe(false);
    expect(isValidVacation("2026-11-10", 61)).toBe(false);
    expect(isValidVacation("2026-11-10", 10.5)).toBe(false);
    expect(isValidVacation("10/11/2026", 10)).toBe(false);
  });
  it("acha o começo e o fim de uma sequência de férias", () => {
    const keys = new Set([...vacationDayKeys("2026-11-10", 5), "2026-11-20"]);
    expect(contiguousEnd("2026-11-12", keys)).toBe("2026-11-14");
    expect(contiguousStart("2026-11-12", keys)).toBe("2026-11-10");
    expect(contiguousEnd("2026-11-20", keys)).toBe("2026-11-20");
  });
});
