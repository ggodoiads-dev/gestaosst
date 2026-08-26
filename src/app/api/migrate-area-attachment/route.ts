import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await db.$executeRawUnsafe(`ALTER TYPE "AttachmentContext" ADD VALUE IF NOT EXISTS 'AREA';`);
  await db.$executeRawUnsafe(`ALTER TABLE "Attachment" ADD COLUMN IF NOT EXISTS "areaId" TEXT;`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attachment_areaId_idx" ON "Attachment"("areaId");`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Attachment_equipmentDamageId_idx" ON "Attachment"("equipmentDamageId");`);

  try {
    await db.$executeRawUnsafe(
      `ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;`,
    );
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("already exists")) throw e;
  }

  const attachmentCount = await db.attachment.count({ where: { context: "AREA" } });
  return NextResponse.json({ ok: true, attachmentCount });
}
