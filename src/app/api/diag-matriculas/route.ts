import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

const FILE_MATRICULAS = [
  "11127","11191","11192","11196","11199","11200","11202","11205","11206","11209",
  "11210","11211","11216","11217","11221","11222","11223","11224","11225","11226",
  "11228","11230","11231","11232","11233","11234","11235","11236","11237","11238",
  "11239","11240","11241","11242","11243","11244","11245","11246",
  "230019","230020","230021","230024","230026","230028","230030","230031","230038",
  "230040","230043","230044","230054","230060","230062","230064","230065","230066",
  "230067","90834",
];

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const collaborators = await db.collaborator.findMany({
    where: { matricula: { in: FILE_MATRICULAS } },
    select: { matricula: true, name: true },
  });
  const foundSet = new Set(collaborators.map((c) => c.matricula));
  const missing = FILE_MATRICULAS.filter((m) => !foundSet.has(m));

  // pra cada matricula ausente, procura colaboradores com matricula parecida (prefixo/sufixo) —
  // pode ser typo de zero a mais/a menos.
  const nearMatches = await Promise.all(
    missing.map(async (m) => {
      const candidates = await db.collaborator.findMany({
        where: {
          OR: [
            { matricula: { contains: m } },
            { matricula: { startsWith: m.slice(0, -1) } },
          ],
        },
        select: { id: true, name: true, matricula: true, active: true },
      });
      return { fileMatricula: m, candidates };
    }),
  );

  return NextResponse.json({ missingCount: missing.length, missing: nearMatches });
}
