import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "ed79bc13531f82ce624704f03aca82be9b61d78d86d6030dee76aebad3df742b";

// Lista fechada aprovada pelo usuário em 2026-10-07 (14 colaboradores desligados que ainda tinham login).
const APPROVED_EMAILS = [
  "aislan@log20.com.br",
  "alex2@log20.com.br",
  "amanda@log20.com.br",
  "douglas@log20.com.br",
  "edineia@log20.com.br",
  "gabriel@log20.com.br",
  "janaina@log20.com.br",
  "jessica@log20.com.br",
  "joao2@log20.com.br",
  "jocieli@log20.com.br",
  "maik@log20.com.br",
  "mario@log20.com.br",
  "roseli@log20.com.br",
  "sidnei@log20.com.br",
];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Só desativa quem está na lista E cujo colaborador vinculado está mesmo desligado.
  const targets = await db.user.findMany({
    where: { active: true, email: { in: APPROVED_EMAILS }, collaboratorProfile: { is: { active: false } } },
    select: { id: true, name: true, email: true },
  });

  if (targets.length > 0) {
    await db.$transaction([
      db.user.updateMany({ where: { id: { in: targets.map((t) => t.id) } }, data: { active: false } }),
      db.auditLog.createMany({
        data: targets.map((t) => ({
          userId: null,
          action: "CANCEL",
          entityType: "User",
          entityId: t.id,
          previousValue: JSON.stringify({ active: true }),
          newValue: JSON.stringify({ active: false, reason: "Colaborador desligado (limpeza em lote)" }),
        })),
      }),
    ]);
  }

  return NextResponse.json({
    approved: APPROVED_EMAILS.length,
    deactivated: targets.length,
    users: targets.map((t) => `${t.name} <${t.email}>`),
  });
}
