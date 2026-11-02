import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "2d802ef834e17c599cccf57afea6522e64716cebfbe5222531ac9c5ccbd63824";

// SOMENTE LEITURA: mostra o cadastro (função, área, checklists exigidos, usuário vinculado) dos colaboradores com "jean" no nome. Não altera nada.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const collaborators = await db.collaborator.findMany({
    where: { name: { contains: "jean", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      active: true,
      cargo: true,
      requiresChecklist: true,
      checklistEnabled: true,
      userId: true,
      area: { select: { name: true } },
      function: { select: { name: true, requiredChecklists: { select: { template: { select: { name: true } } } } } },
    },
  });
  const users = await db.user.findMany({
    where: { id: { in: collaborators.map((c) => c.userId).filter((id): id is string => !!id) } },
    select: { id: true, name: true, email: true, active: true, role: { select: { key: true } }, userAreas: { select: { area: { select: { name: true } } } } },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  return NextResponse.json({
    colaboradores: collaborators.map((c) => ({
      nome: c.name,
      ativo: c.active,
      cargoTexto: c.cargo,
      funcao: c.function?.name ?? null,
      checklistsExigidosPelaFuncao: c.function?.requiredChecklists.map((r) => r.template.name) ?? [],
      areaDoCadastro: c.area?.name ?? null,
      exigeChecklist: c.requiresChecklist,
      fazChecklist: c.checklistEnabled,
      usuarioVinculado: c.userId ? (() => { const u = userById.get(c.userId!); return u ? { nome: u.name, email: u.email, ativo: u.active, perfil: u.role.key, areasComAcesso: u.userAreas.map((a) => a.area.name) } : "id sem usuário"; })() : null,
    })),
  });
}
