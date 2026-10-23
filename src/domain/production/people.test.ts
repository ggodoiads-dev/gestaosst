import { describe, expect, it } from "vitest";
import { parseHelpersPeople, shareQuantity, suggestActivityId } from "./people";

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
🔵*QLP*= 
 
🔴*Area Seleção*🔴
🔵 DPVIM 
 Everton
Thomas 
Jean 
Wagner

6904497
Bom =269
Reforma =61
Chapa transferência =207

Dpvim=6914473
Palltes e Chapa 

Bom=171
Reforma=32
Descarte =9
Chapa transferência =147

🔴Chapatex 
🟤*Quadro
🟢*Bulks*🟢
⚫*Retrabalho*
 
⚫*Quedas*

⚪️*5S*⚪️
⚪️*Armazem* 
Stefany 
Amanda 

🔴*total 
Chapas selecionadas =00
Palltes selecionado = 533
Chapa dpvim=354`;

const HELPERS = [
  { id: "stefany", name: "STEFANY RAPINI" },
  { id: "jessika", name: "JESSIKA TALLITA SILVA ANTUNES" },
  { id: "amanda", name: "AMANDA LEOPOLDINO MACIEL" },
  { id: "tanahan", name: "TANAHAN ANDREI DE CAMARGO" },
  { id: "jeanb", name: "JEAN BARBOZA BARROSO" },
  { id: "jeanj", name: "JEAN DE JESUS CARNEIRO" },
  { id: "bernardo", name: "BERNARDO FERREIRA" },
  { id: "everton", name: "EVERTON MAJOR KREMER" },
  { id: "thomas", name: "THOMAS VIEIRA KOCH" },
  { id: "wagner", name: "WAGNER LUIS DOS SANTOS" },
  { id: "antonio", name: "ANTONIO CARLOS GARCIA MIRANDA" },
];

describe("fechamento dos ajudantes por pessoa", () => {
  it("modelo 1: chapatex por pessoa, quadro e dpvim em equipe", () => {
    const { entries } = parseHelpersPeople(HELPERS_1, HELPERS);
    const chapatex = entries.filter((e) => e.section === "chapatex");
    expect(chapatex.map((e) => [e.people[0].candidateIds, e.quantity])).toEqual([
      [["stefany"], 2000],
      [["jessika"], 2200],
    ]);
    expect(chapatex[0].details).toEqual({ quebra: 2, transf: 7 });
    const quadro = entries.find((e) => e.section === "quadro")!;
    expect(quadro.people[0].candidateIds).toEqual(["tanahan"]);
    expect(quadro.quantity).toBe(300); // bom + reforma
    const dpvim = entries.find((e) => e.section === "dpvim")!;
    expect(dpvim.people.map((p) => p.candidateIds)).toEqual([["jeanb", "jeanj"], ["bernardo"]]); // Jean é ambíguo
    expect(dpvim.quantity).toBe(180);
    expect(dpvim.details).toMatchObject({ bom: 135, reforma: 45, descarte: 15, transf: 143, quebra: 7 });
  });

  it("modelo 2: a equipe vem antes e vale para os dois blocos de números do dpvim", () => {
    const { entries } = parseHelpersPeople(HELPERS_2, HELPERS);
    const dpvim = entries.filter((e) => e.section === "dpvim");
    expect(dpvim).toHaveLength(2);
    expect(dpvim[0].people.map((p) => p.text)).toEqual(["Everton", "Thomas", "Jean", "Wagner"]);
    expect(dpvim[0].quantity).toBe(269 + 61);
    expect(dpvim[1].quantity).toBe(171 + 32);
    expect(dpvim[1].people).toHaveLength(4);
    const armazem = entries.find((e) => e.section === "armazem")!;
    expect(armazem.people.map((p) => p.candidateIds[0])).toEqual(["stefany", "amanda"]);
    expect(armazem.quantity).toBeNull();
    expect(entries.some((e) => e.section === "5s")).toBe(false);
  });

  it("5S e armazém só com nomes registram quem fez, sem quantidade", () => {
    const { entries } = parseHelpersPeople(`*5S*
Stefany
Amanda
*total chapas:10`, HELPERS);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ section: "5s", quantity: null });
    expect(entries[0].people.map((p) => p.candidateIds[0])).toEqual(["stefany", "amanda"]);
  });

  it("divide a quantidade da equipe e sugere a atividade pelo nome", () => {
    expect(shareQuantity(330, 4)).toEqual([83, 83, 82, 82]);
    expect(shareQuantity(null, 2)).toEqual([null, null]);
    const acts = [
      { id: "1", name: "Separação e seleção de chapatex" },
      { id: "2", name: 'Separação e seleção de paletes e chapatex "DPVIM"' },
      { id: "3", name: "Separação e seleção de quadros." },
      { id: "4", name: "5s Geral" },
    ];
    expect(suggestActivityId("chapatex", acts)).toBe("1");
    expect(suggestActivityId("dpvim", acts)).toBe("2");
    expect(suggestActivityId("quadro", acts)).toBe("3");
    expect(suggestActivityId("5s", acts)).toBe("4");
  });
});
