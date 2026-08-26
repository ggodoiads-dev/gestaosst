import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const area = await db.area.findFirst({
    where: { name: { contains: "Reforma de Paletes", mode: "insensitive" } },
    select: { id: true, name: true, qrToken: true },
  });

  const attachments = area
    ? await db.attachment.findMany({
        where: { areaId: area.id },
        select: { id: true, context: true, docType: true, filename: true, path: true, mimeType: true, size: true, uploadedAt: true },
      })
    : [];

  return NextResponse.json({ ok: true, area, attachments, storageDriver: process.env.STORAGE_DRIVER ?? "local" });
}
