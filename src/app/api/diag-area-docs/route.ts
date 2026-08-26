import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getCollaboratorQualificationSummary } from "@/server/services/qualification.service";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const areas = await db.area.findMany({
    where: { name: { contains: "reforma", mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      qrToken: true,
      attachments: {
        select: { id: true, context: true, docType: true, filename: true, uploadedAt: true },
      },
      collaborators: {
        where: { active: true },
        select: { id: true, name: true, function: { select: { id: true, name: true, requiresNr: true } } },
      },
    },
  });

  const collaboratorSummaries = await Promise.all(
    areas.flatMap((a) =>
      a.collaborators.map(async (c) => ({
        areaName: a.name,
        collaboratorName: c.name,
        functionName: c.function?.name ?? null,
        functionRequiresNr: c.function?.requiresNr ?? null,
        summary: await getCollaboratorQualificationSummary(c.id),
      })),
    ),
  );

  const jobFunctions = await db.jobFunction.findMany({
    where: { name: { contains: "reforma", mode: "insensitive" } },
    select: { id: true, name: true, requiresNr: true },
  });

  return NextResponse.json({ ok: true, areas, jobFunctions, collaboratorSummaries });
}
