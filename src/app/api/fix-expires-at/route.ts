import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { addMonths } from "date-fns";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apply = request.nextUrl.searchParams.get("apply") === "1";

  const records = await db.qualificationRecord.findMany({
    include: { qualificationType: { select: { name: true, validityMonths: true } }, collaborator: { select: { name: true } } },
  });

  const mismatched = records
    .map((r) => {
      const correctExpiresAt = r.qualificationType.validityMonths
        ? addMonths(r.completedDate, r.qualificationType.validityMonths)
        : null;
      return { record: r, correctExpiresAt };
    })
    .filter(({ record, correctExpiresAt }) => correctExpiresAt?.getTime() !== record.expiresAt?.getTime());

  const preview = mismatched.map(({ record, correctExpiresAt }) => ({
    id: record.id,
    collaboratorName: record.collaborator.name,
    typeName: record.qualificationType.name,
    validityMonths: record.qualificationType.validityMonths,
    completedDate: record.completedDate,
    storedExpiresAt: record.expiresAt,
    correctExpiresAt,
  }));

  if (!apply) {
    return NextResponse.json({ preview: true, totalRecords: records.length, mismatchedCount: mismatched.length, mismatched: preview });
  }

  for (const { record, correctExpiresAt } of mismatched) {
    await db.qualificationRecord.update({ where: { id: record.id }, data: { expiresAt: correctExpiresAt } });
  }

  return NextResponse.json({ applied: true, fixedCount: mismatched.length });
}
