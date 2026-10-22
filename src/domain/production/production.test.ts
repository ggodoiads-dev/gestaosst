import { describe, expect, it } from "vitest";
import { parseAnyProductionMessage, parseProductionMessage } from "./parse";
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

const HELPERS_1 = `fechamento Turno B*
*Data* 19/10/2026

"ANTÔNIO CARLOS"

🔴*QLP*=
🔴*Area Seleção*🔴
⚫*Chapatex*

Stefany:2000
Quebra:2
Transf:7

Jessika:2200
Quebra:1

⚫*Quadro*
Andrei
Bom:250
Reforma:50

🔴*Dpvim pallet*🔴           6915102

Jean/Bernardo
Bom:135
Reforma:45
Oi:3
PALLET descarte:15
Chapas transferência:143
Chapas quebradas:7

⚫*Retrabalho*
🔴*total chapas:6211`;

const HELPERS_2 = `🟡*fechamento Turno B*
*Data* 18/10/2026
*Lider*Endryk Rodrigues
🔴*Area Seleção*🔴
Dpvim=6914473
Bom=171
Reforma=32
Descarte =9
Chapa transferência =147

🔴*total
Chapas selecionadas =00
Palltes selecionado = 533
Chapa dpvim=354`;

describe("fechamento dos ajudantes", () => {
  it("soma Bom/Reforma/Descarte/Transf/Quebra e lê o total de chapas", () => {
    const r = parseAnyProductionMessage(HELPERS_1);
    expect(r.values).toMatchObject({ selecaoBom: 385, selecaoReforma: 95, selecaoDescarte: 15, selecaoTransferencia: 150, selecaoQuebra: 10, selecaoTotalChapas: 6211 });
    expect(r.date).toEqual({ day: 19, month: 10, year: 2026 });
    expect(r.turno).toBe("B");
  });
  it("lê os totais de pallets e chapas selecionados (formato com igual)", () => {
    const r = parseAnyProductionMessage(HELPERS_2);
    expect(r.values).toMatchObject({ selecaoPalletsSelecionados: 533, selecaoChapasSelecionadas: 0, selecaoChapaDpvim: 354, selecaoBom: 171, selecaoReforma: 32, selecaoDescarte: 9, selecaoTransferencia: 147 });
    expect(r.date).toEqual({ day: 18, month: 10, year: 2026 });
  });
  it("a mensagem do líder continua indo para o leitor do líder", () => {
    expect(parseAnyProductionMessage(MESSAGE).values.carrosCarregados).toBe(21);
  });
});
