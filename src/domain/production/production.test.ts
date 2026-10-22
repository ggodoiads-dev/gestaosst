import { describe, expect, it } from "vitest";
import { parseProductionMessage } from "./parse";
import { sanitizeProductionValues, totalOfGroup } from "./fields";

const MESSAGE = `📋 *RELATÓRIO DE TURNO – A* 21/10/2026

*GERAL*
🔻 Queda Produto: 0
👷 ABS Operador: 1
🚛 Carros Trabalhados: 24
🔗 Carros Amarrados: 22
✅ Carros Carregados: 21
Pré-carga Rodo: 03
Pré-carga Total: 05
Rodotrem: 2
Frota Fixa: 4
Fila Carregamento: 1
Ajuste de Carros: -1

*CARGAS*
Almox Carregado: 2
Pallets Carregados: 310
Quadros Carregados: 40
Chapatex Carregados: 12
Bulks Carregados: 33

*DESCARGAS*
Bulk: 5
Quadro: 3
Chapatex: 1
Pallets Dpvin: 120
Insumos: 2
Devoluções: 1
Almoxarifado: 0

*OBSERVAÇÕES*
Foram levados 33 bulks para quebra, e ficou um rodo pra fazer o carregamento.
Bulk: 99 (não deve virar campo)`;

describe("parseProductionMessage", () => {
  const parsed = parseProductionMessage(MESSAGE);

  it("lê os campos de cada seção", () => {
    expect(parsed.values.carrosCarregados).toBe(21);
    expect(parsed.values.carrosTrabalhados).toBe(24);
    expect(parsed.values.carrosAmarrados).toBe(22);
    expect(parsed.values.preCargaRodo).toBe(3);
    expect(parsed.values.ajusteCarros).toBe(-1);
    expect(parsed.values.queda).toBeUndefined();
    expect(parsed.values.quedaProduto).toBe(0);
    expect(parsed.values.bulksCarregados).toBe(33);
    expect(parsed.values.palletsCarregados).toBe(310);
  });

  it("separa 'Bulk' da descarga de 'Bulks carregados' da carga", () => {
    expect(parsed.values.descargaBulk).toBe(5);
    expect(parsed.values.bulksCarregados).toBe(33);
    expect(parsed.values.descargaPalletsDpvin).toBe(120);
    expect(parsed.values.descargaDevolucoes).toBe(1);
  });

  it("guarda as observações como texto livre e não lê números nelas", () => {
    expect(parsed.notes).toContain("33 bulks para quebra");
    expect(parsed.values.descargaBulk).toBe(5);
    expect(totalOfGroup(parsed.values, "DESCARGAS")).toBe(5 + 3 + 1 + 120 + 2 + 1 + 0);
  });

  it("acha data e turno do cabeçalho", () => {
    expect(parsed.date).toEqual({ day: 21, month: 10, year: 2026 });
    expect(parsed.turno).toBe("A");
  });

  it("avisa das linhas que não reconheceu", () => {
    const r = parseProductionMessage("GERAL\nCarros Carregados: 4\nCoisa Estranha: 7");
    expect(r.values.carrosCarregados).toBe(4);
    expect(r.unmatched).toEqual(["Coisa Estranha: 7"]);
  });
});

describe("sanitizeProductionValues", () => {
  it("descarta chaves desconhecidas, negativos onde não cabe e lixo", () => {
    expect(sanitizeProductionValues({ carrosCarregados: 5.4, ajusteCarros: -2, rodotrem: -1, foo: 3, frotaFixa: "7" })).toEqual({ carrosCarregados: 5, ajusteCarros: -2 });
  });
});
