import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { formatInTimeZone } from "date-fns-tz";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";
const APP_TIMEZONE = "America/Sao_Paulo";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const ignoredRecently = await db.ignoredTimeClockPis.findMany({
    where: { ignoredAt: { gte: since } },
    orderBy: { ignoredAt: "desc" },
  });

  const auditRecently = await db.auditLog.findMany({
    where: { entityType: "Collaborator", action: "UPDATE", occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  const linkedAudits = auditRecently.filter((a) => {
    if (!a.newValue) return false;
    try {
      const nv = JSON.parse(a.newValue) as { linkedTimeClockRecords?: number };
      return typeof nv.linkedTimeClockRecords === "number";
    } catch {
      return false;
    }
  });

  return NextResponse.json({
    sinceIso: since.toISOString(),
    ignoredRecentlyCount: ignoredRecently.length,
    ignoredRecently: ignoredRecently.map((i) => ({ pis: i.pis, ignoredAt: formatInTimeZone(i.ignoredAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm") })),
    linkedRecentlyCount: linkedAudits.length,
    linkedRecently: linkedAudits.map((a) => ({
      collaboratorId: a.entityId,
      newValue: a.newValue ? JSON.parse(a.newValue) : null,
      occurredAt: formatInTimeZone(a.occurredAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm"),
    })),
  });
}
