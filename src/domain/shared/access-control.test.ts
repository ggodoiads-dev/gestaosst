import { describe, expect, it } from "vitest";
import { hasPermission, requirePermission, requireAreaAccess, ForbiddenError, type CurrentUser } from "./access-control";
import { PERMISSIONS } from "./permissions";

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "user-1",
    name: "Usuário Teste",
    email: "teste@demo.com",
    active: true,
    roleId: "role-1",
    roleKey: "COLABORADOR",
    roleName: "Colaborador",
    unitId: null,
    permissions: new Set(),
    areaIds: new Set(),
    ...overrides,
  };
}

describe("hasPermission / requirePermission", () => {
  it("retorna verdadeiro quando o usuário possui a permissão", () => {
    const user = makeUser({ permissions: new Set([PERMISSIONS.CHECKLIST_EXECUTE]) });
    expect(hasPermission(user, PERMISSIONS.CHECKLIST_EXECUTE)).toBe(true);
  });

  it("retorna falso quando o usuário não possui a permissão", () => {
    const user = makeUser({ permissions: new Set() });
    expect(hasPermission(user, PERMISSIONS.USER_MANAGE)).toBe(false);
  });

  it("lança ForbiddenError quando a permissão exigida está ausente", () => {
    const user = makeUser({ permissions: new Set() });
    expect(() => requirePermission(user, PERMISSIONS.USER_MANAGE)).toThrow(ForbiddenError);
  });

  it("não lança quando a permissão exigida está presente", () => {
    const user = makeUser({ permissions: new Set([PERMISSIONS.USER_MANAGE]) });
    expect(() => requirePermission(user, PERMISSIONS.USER_MANAGE)).not.toThrow();
  });
});

describe("requireAreaAccess", () => {
  it("permite acesso quando o usuário tem a área liberada", () => {
    const user = makeUser({ areaIds: new Set(["area-expedicao"]) });
    expect(() => requireAreaAccess(user, "area-expedicao", PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS)).not.toThrow();
  });

  it("bloqueia acesso a uma área fora da lista permitida do usuário (isolamento por área, seção 52)", () => {
    const user = makeUser({ areaIds: new Set(["area-expedicao"]) });
    expect(() => requireAreaAccess(user, "area-recebimento", PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS)).toThrow(
      ForbiddenError,
    );
  });

  it("permite qualquer área quando o usuário possui a permissão de ver todas as áreas", () => {
    const user = makeUser({
      areaIds: new Set(),
      permissions: new Set([PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS]),
    });
    expect(() => requireAreaAccess(user, "qualquer-area", PERMISSIONS.EQUIPMENT_VIEW_ALL_AREAS)).not.toThrow();
  });
});
