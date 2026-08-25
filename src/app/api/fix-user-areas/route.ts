import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

/**
 * Corrige em massa o mesmo problema achado no Flávio: colaborador com usuário de login
 * (`userId`) e área física cadastrada (`areaId`), mas cujo login não tem essa área liberada
 * como "área de acesso" (`UserArea`) — normalmente porque o colaborador foi remanejado de área
 * depois que o acesso dele já tinha sido criado. Só ADICIONA a área que falta, nunca remove
 * nenhuma área de acesso já concedida (alguém pode ter acesso a mais áreas do que a própria de
 * propósito, ex: um líder). Sem `&apply=1` só lista quem seria afetado, sem gravar nada.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const apply = request.nextUrl.searchParams.get("apply") === "1";

  const collaborators = await db.collaborator.findMany({
    where: { userId: { not: null }, areaId: { not: null } },
    select: {
      name: true,
      areaId: true,
      area: { select: { name: true } },
      userId: true,
      user: { select: { id: true, name: true, active: true, userAreas: { select: { areaId: true } } } },
    },
  });

  const toFix: { collaboratorName: string; userId: string; userName: string; userActive: boolean; areaId: string; areaName: string }[] = [];
  for (const c of collaborators) {
    if (!c.userId || !c.areaId || !c.user) continue;
    const alreadyHasArea = c.user.userAreas.some((ua) => ua.areaId === c.areaId);
    if (!alreadyHasArea) {
      toFix.push({
        collaboratorName: c.name,
        userId: c.userId,
        userName: c.user.name,
        userActive: c.user.active,
        areaId: c.areaId,
        areaName: c.area?.name ?? "?",
      });
    }
  }

  if (apply && toFix.length > 0) {
    await db.userArea.createMany({
      data: toFix.map((f) => ({ userId: f.userId, areaId: f.areaId })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true, applied: apply, affectedCount: toFix.length, toFix });
}
