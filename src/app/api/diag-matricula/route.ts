import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "4c9a2e6f1d8b5a3c7e0f9b2d6a4c8e1f5b9d3a7c0e4f8b2d6a9c3e7f1b5d0a8c";

const TARGET = [
  "91213084490","02378972634","00707935085","04169059828","09378729953","00000000000",
  "05606139353","03284652362","02223715716","91386722898","00411157213","08206401475",
  "03942058484","02653700043","00378689900","01729968148","03907141188","07028343680",
  "00794506407","05347890964","03174968786","91168015898","90792289196","02796814006",
  "90661533190","91330639499","91509013490","90127214593","06578837636","07875237963",
  "91057638595","02365026436","04103003221","01750960623","03681790784","05742062520",
  "03845878056","02614903223","09211384803","91282261398","09628910864","03720660825",
  "01258495235","00926177639",
];

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const collaborators = await db.collaborator.findMany({
    select: { name: true, matricula: true, pis: true, active: true },
  });

  const exactMatch = TARGET.filter((t) => collaborators.some((c) => c.matricula === t));
  const numericMatch = TARGET.filter((t) => {
    const tNum = String(Number(t));
    return collaborators.some((c) => c.matricula && String(Number(c.matricula)) === tNum && !Number.isNaN(Number(c.matricula)));
  });

  return NextResponse.json({
    totalCollaborators: collaborators.length,
    sampleMatriculas: collaborators.slice(0, 15).map((c) => ({ name: c.name, matricula: c.matricula, pis: c.pis })),
    exactMatchCount: exactMatch.length,
    numericMatchCount: numericMatch.length,
    numericMatchExamples: numericMatch.slice(0, 5),
  });
}
