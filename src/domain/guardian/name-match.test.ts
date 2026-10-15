import { describe, it, expect } from "vitest";
import { matchCollaboratorByName, nameTokens } from "./name-match";

const c = (id: string, name: string, active = true) => ({ id, name, active });

describe("matchCollaboratorByName", () => {
  const people = [
    c("1", "LUCAS BUENO DA SILVA"),
    c("2", "BRYAN DE LIMA VAZ"),
    c("3", "PAMELA DA SILVA VAZ"),
    c("4", "MARIA JOSE SANTOS"),
    c("5", "MARIA APARECIDA SANTOS"),
  ];

  it("casa o nome abreviado do Guardian com o nome completo do cadastro", () => {
    const r = matchCollaboratorByName("LUCAS BUENO", people);
    expect(r.status).toBe("matched");
    if (r.status === "matched") expect(r.collaborator.id).toBe("1");
  });

  it("ignora acento, caixa e preposições (de/da/do)", () => {
    const r = matchCollaboratorByName("Bryan Lima Vaz", people);
    expect(r.status === "matched" && r.collaborator.id).toBe("2");
    const r2 = matchCollaboratorByName("BRYAN DE LIMA VAZ", people);
    expect(r2.status === "matched" && r2.how).toBe("exato");
  });

  it("casa por primeiro e último nome", () => {
    const r = matchCollaboratorByName("LUCAS SILVA", people);
    expect(r.status === "matched" && r.collaborator.id).toBe("1");
  });

  it("nome ambíguo não chuta", () => {
    const r = matchCollaboratorByName("MARIA SANTOS", people);
    expect(r.status).toBe("ambiguous");
  });

  it("entre homônimos, só um ativo resolve", () => {
    const r = matchCollaboratorByName("LUCAS BUENO", [c("a", "LUCAS BUENO DA SILVA", false), c("b", "LUCAS BUENO PEREIRA", true)]);
    expect(r.status === "matched" && r.collaborator.id).toBe("b");
  });

  it("primeiro nome sozinho não identifica ninguém", () => {
    expect(matchCollaboratorByName("LUCAS", people).status).toBe("none");
  });

  it("quem não está no cadastro não casa", () => {
    expect(matchCollaboratorByName("FERNANDO ROBERTO BREDA", people).status).toBe("none");
  });

  it("tokens", () => {
    expect(nameTokens("João da Silva")).toEqual(["joao", "silva"]);
  });
});
