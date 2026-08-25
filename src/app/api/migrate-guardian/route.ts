import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await db.$executeRawUnsafe(
      `CREATE TYPE "GuardianReportType" AS ENUM ('COMPORTAMENTO_RISCO', 'CONDICAO', 'INCIDENTE', 'RECONHECIMENTO');`,
    );
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("already exists")) throw e;
  }

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "GuardianReport" (
        "id" TEXT NOT NULL,
        "guardianId" TEXT NOT NULL,
        "type" "GuardianReportType" NOT NULL,
        "categoryName" TEXT,
        "description" TEXT,
        "occurredAt" TIMESTAMP(3),
        "reportedAt" TIMESTAMP(3),
        "unit" TEXT,
        "area" TEXT,
        "subArea" TEXT,
        "location" TEXT,
        "equipment" TEXT,
        "reporterName" TEXT,
        "reporterExternalId" TEXT,
        "reporterEmail" TEXT,
        "reporterCompany" TEXT,
        "reporterCollaboratorId" TEXT,
        "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
        "raw" TEXT,
        "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "importedById" TEXT NOT NULL,

        CONSTRAINT "GuardianReport_pkey" PRIMARY KEY ("id")
    );
  `);

  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "GuardianReport_guardianId_key" ON "GuardianReport"("guardianId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GuardianReport_type_idx" ON "GuardianReport"("type");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GuardianReport_occurredAt_idx" ON "GuardianReport"("occurredAt");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "GuardianReport_reporterCollaboratorId_idx" ON "GuardianReport"("reporterCollaboratorId");`);

  const fkStatements = [
    `ALTER TABLE "GuardianReport" ADD CONSTRAINT "GuardianReport_reporterCollaboratorId_fkey" FOREIGN KEY ("reporterCollaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
    `ALTER TABLE "GuardianReport" ADD CONSTRAINT "GuardianReport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
  ];
  for (const stmt of fkStatements) {
    try {
      await db.$executeRawUnsafe(stmt);
    } catch (e) {
      if (!(e instanceof Error) || !e.message.includes("already exists")) throw e;
    }
  }

  const permissionKey = "guardian.manage";
  await db.permission.upsert({
    where: { key: permissionKey },
    update: { description: "Importar e consultar relatos do Guardian" },
    create: { key: permissionKey, description: "Importar e consultar relatos do Guardian" },
  });
  const permission = await db.permission.findUniqueOrThrow({ where: { key: permissionKey } });

  const grantedTo: string[] = [];
  for (const roleKey of ["GESTOR", "ADMINISTRADOR"]) {
    const role = await db.role.findUnique({ where: { key: roleKey } });
    if (!role) continue;
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
    grantedTo.push(roleKey);
  }

  const reportCount = await db.guardianReport.count();

  return NextResponse.json({ ok: true, grantedTo, reportCount });
}
