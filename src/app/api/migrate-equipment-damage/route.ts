import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await db.$executeRawUnsafe(`CREATE TYPE "EquipmentDamageStatus" AS ENUM ('ABERTO', 'EM_REPARO', 'RESOLVIDO');`);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("already exists")) throw e;
  }

  await db.$executeRawUnsafe(`ALTER TYPE "AttachmentContext" ADD VALUE IF NOT EXISTS 'AVARIA';`);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EquipmentDamage" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "equipmentId" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "collaboratorId" TEXT,
        "description" TEXT NOT NULL,
        "cost" DECIMAL(10,2),
        "status" "EquipmentDamageStatus" NOT NULL DEFAULT 'ABERTO',
        "notes" TEXT,
        "reportedById" TEXT NOT NULL,
        "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "resolvedAt" TIMESTAMP(3),

        CONSTRAINT "EquipmentDamage_pkey" PRIMARY KEY ("id")
    );
  `);

  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EquipmentDamage_code_key" ON "EquipmentDamage"("code");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EquipmentDamage_equipmentId_idx" ON "EquipmentDamage"("equipmentId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EquipmentDamage_status_idx" ON "EquipmentDamage"("status");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EquipmentDamage_date_idx" ON "EquipmentDamage"("date");`);

  await db.$executeRawUnsafe(`ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "equipmentDamageId" TEXT;`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attachment_equipmentDamageId_idx" ON "Attachment"("equipmentDamageId");`);

  const fkStatements = [
    `ALTER TABLE "EquipmentDamage" ADD CONSTRAINT "EquipmentDamage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
    `ALTER TABLE "EquipmentDamage" ADD CONSTRAINT "EquipmentDamage_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
    `ALTER TABLE "EquipmentDamage" ADD CONSTRAINT "EquipmentDamage_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`,
    `ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_equipmentDamageId_fkey" FOREIGN KEY ("equipmentDamageId") REFERENCES "EquipmentDamage"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
  ];
  for (const stmt of fkStatements) {
    try {
      await db.$executeRawUnsafe(stmt);
    } catch (e) {
      if (!(e instanceof Error) || !e.message.includes("already exists")) throw e;
    }
  }

  const permissionKey = "equipment_damage.manage";
  await db.permission.upsert({
    where: { key: permissionKey },
    update: { description: "Registrar e tratar avarias em equipamentos (frota)" },
    create: { key: permissionKey, description: "Registrar e tratar avarias em equipamentos (frota)" },
  });
  const permission = await db.permission.findUniqueOrThrow({ where: { key: permissionKey } });

  const grantedTo: string[] = [];
  for (const roleKey of ["LIDER_SUPERVISOR", "GESTOR", "ADMINISTRADOR"]) {
    const role = await db.role.findUnique({ where: { key: roleKey } });
    if (!role) continue;
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
    grantedTo.push(roleKey);
  }

  const damageCount = await db.equipmentDamage.count();

  return NextResponse.json({ ok: true, grantedTo, damageCount });
}
