import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

const TOKEN_SHA256 = "6d570eaba6175eff44576fa4fef6e7e79c24cd02c854437bd2432516917e2059";

// Diagnóstico SOMENTE LEITURA de um equipamento (histórico de status/área). Não grava nada.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const given = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const expected = Buffer.from(TOKEN_SHA256);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const code = url.searchParams.get("code") ?? "LOG20-EQ-0055";
  const equipment = await db.equipment.findFirst({ where: { code }, select: { id: true, code: true, name: true, status: true, active: true, areaId: true, createdAt: true, area: { select: { name: true } } } });
  if (!equipment) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [events, areaHistory, assignments] = await Promise.all([
    db.equipmentEvent.findMany({ where: { equipmentId: equipment.id }, orderBy: { occurredAt: "asc" }, select: { type: true, description: true, occurredAt: true } }),
    db.equipmentAreaHistory.findMany({ where: { equipmentId: equipment.id }, orderBy: { changedAt: "asc" }, select: { previousAreaId: true, newAreaId: true, changedAt: true, reason: true } }),
    db.equipmentChecklistAssignment.findMany({ where: { equipmentId: equipment.id }, select: { active: true, template: { select: { name: true } } } }),
  ]);
  return NextResponse.json({ equipment, assignments, areaHistory, events });
}
