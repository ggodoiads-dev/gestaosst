import { describe, expect, it } from "vitest";
import { isLog20Company } from "./import-fields";

describe("isLog20Company", () => {
  it("reconhece a LOG20 em várias grafias", () => {
    for (const name of ["LOG20", "LOG 20", "Log-20 Logística", "log 20 transportes", " L.O.G 20 "]) expect(isLog20Company(name)).toBe(true);
  });
  it("ignora outras empresas", () => {
    for (const name of ["TIRIVA", "Vidros Paraná", "AMBEV"]) expect(isLog20Company(name)).toBe(false);
  });
});
