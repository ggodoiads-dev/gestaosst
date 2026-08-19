import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "6d2a8f4e1c7b9a3d5f0e8c2b6a4d9f1e3c7b0a5d8f2e6c9b3a1d7f4e0c8b5a2d";

const TARGET_PIS = [
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

  const totalCollaborators = await db.collaborator.count();
  const withPis = await db.collaborator.count({ where: { pis: { not: null } } });
  const allPisValues = await db.collaborator.findMany({
    where: { pis: { not: null } },
    select: { name: true, pis: true, matricula: true, active: true },
  });

  const matchedTargets = TARGET_PIS.filter((p) => allPisValues.some((c) => c.pis === p));

  return NextResponse.json({
    totalCollaborators,
    withPis,
    samplePisInDb: allPisValues.slice(0, 10),
    matchedTargetsCount: matchedTargets.length,
    matchedTargets,
  });
}
