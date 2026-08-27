import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const area = await db.area.findFirst({
    where: { name: { contains: "Paletes", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      qrToken: true,
      attachments: {
        select: { id: true, context: true, docType: true, filename: true, path: true, mimeType: true, uploadedAt: true },
      },
    },
  });

  // Também busca QUALQUER anexo recente (últimos 15 min) pra ver onde ele realmente foi parar,
  // caso não esteja vinculado a essa área.
  const recentAttachments = await db.attachment.findMany({
    where: { uploadedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    select: { id: true, context: true, docType: true, filename: true, areaId: true, uploadedAt: true },
    orderBy: { uploadedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ ok: true, area, recentAttachments });
}
