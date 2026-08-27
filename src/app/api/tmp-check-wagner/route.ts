import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

const DUPLICATE_ID = "c30ce4cb-ef6e-42f8-81a4-04dc334fb492";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (url.searchParams.get("clearDuplicateMatricula") === "1") {
    const record = await db.collaborator.findUniqueOrThrow({ where: { id: DUPLICATE_ID } });
    if (record.active || record.matricula !== "11250") {
      return NextResponse.json({ error: "safety check failed", record }, { status: 400 });
    }
    const updated = await db.collaborator.update({
      where: { id: DUPLICATE_ID },
      data: { matricula: null },
    });
    return NextResponse.json({ cleared: true, updated });
  }

  const matches = await db.collaborator.findMany({
    where: { name: { contains: "wagner augusto", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      matricula: true,
      pis: true,
      cpf: true,
      active: true,
      areaId: true,
      area: { select: { name: true } },
      function: { select: { name: true } },
      createdAt: true,
      inactivatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ count: matches.length, matches });
}
