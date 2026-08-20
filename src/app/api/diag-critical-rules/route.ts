import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

const TOKEN = "7d3a9f2c6e0b8a4d1f7c3e9b6a2d8f5c0e4b7a1d9f3c6e8b2a5d0f7c4e9b1a6d";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const questions = await db.checklistQuestion.findMany({
    include: {
      rules: true,
      version: { select: { status: true, template: { select: { name: true } } } },
    },
  });

  const trapped = questions
    .map((q) => ({
      questionId: q.id,
      title: q.title,
      templateName: q.version.template.name,
      versionStatus: q.version.status,
      rules: q.rules.map((r) => ({ triggerValue: r.triggerValue, isCritical: r.isCritical, blocksEquipment: r.blocksEquipment, severity: r.severity, createsNonconformity: r.createsNonconformity })),
    }))
    .filter((q) => q.rules.some((r) => r.isCritical && !(r.blocksEquipment || r.severity === "CRITICA")));

  const noRuleAtAll = questions.filter((q) => q.rules.length === 0).length;

  return NextResponse.json({
    totalQuestions: questions.length,
    questionsWithNoRuleAtAll: noRuleAtAll,
    trappedCount: trapped.length,
    trapped,
  });
}
