import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const COLLABORATOR_ID = "6d93bf4a-de65-4b05-8dca-81c0d0ec84bc";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apply = request.nextUrl.searchParams.get("apply") === "1";

  const collaborator = await db.collaborator.findUnique({ where: { id: COLLABORATOR_ID } });
  if (!collaborator) return NextResponse.json({ error: "colaborador não encontrado" });

  if (!apply) {
    return NextResponse.json({
      preview: true,
      collaborator: { id: collaborator.id, name: collaborator.name, pis: collaborator.pis, matricula: collaborator.matricula },
      note: "chame de novo com &apply=1 pra religar as 40 batidas órfãs do código 11127 a esse colaborador (sem mexer na matrícula já cadastrada)",
    });
  }

  // Matrícula já cadastrada (11227) difere em 1 dígito do código do relógio (11127) — não
  // sobrescreve o cadastro, só religa as batidas órfãs desse código a esse colaborador mesmo.
  const linked = await db.timeClockRecord.updateMany({ where: { pis: "11127", collaboratorId: null }, data: { collaboratorId: COLLABORATOR_ID } });

  return NextResponse.json({ applied: true, name: collaborator.name, matricula: collaborator.matricula, linkedRecords: linked.count });
}
