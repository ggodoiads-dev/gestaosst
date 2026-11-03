import { describe, expect, it } from "vitest";
import { actionGroupKey, groupByAction } from "./action-group";

describe("actionGroupKey", () => {
  it("variações do mesmo assunto caem na mesma chave", () => {
    const k = actionGroupKey("Verificar treinamento de paleteira");
    expect(actionGroupKey("Confirmar treinamento recente em paleteira")).toBe(k);
    expect(actionGroupKey("Verificar qualificação em paleteira")).toBe(k);
    expect(actionGroupKey("Checar capacitação de Paleteira")).toBe(k);
  });
  it("assuntos diferentes não se misturam", () => {
    expect(actionGroupKey("Verificar treinamento de paleteira")).not.toBe(actionGroupKey("Verificar treinamento de empilhadeira"));
    expect(actionGroupKey("Orientar sobre uso de EPI")).not.toBe(actionGroupKey("Orientar sobre empilhamento"));
  });
  it("título só com palavras neutras não vira chave vazia", () => {
    expect(actionGroupKey("Verificar")).toBe("verificar");
  });
});

describe("groupByAction", () => {
  it("agrupa e preserva a ordem do primeiro de cada grupo", () => {
    const rows = [
      { id: 1, title: "Verificar treinamento de paleteira" },
      { id: 2, title: "Orientar sobre EPI" },
      { id: 3, title: "Confirmar treinamento recente em paleteira" },
    ];
    const g = groupByAction(rows);
    expect(g).toHaveLength(2);
    expect(g[0].rows.map((r) => r.id)).toEqual([1, 3]);
    expect(g[0].title).toBe("Verificar treinamento de paleteira");
  });
});
