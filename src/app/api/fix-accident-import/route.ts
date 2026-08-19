import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { parseSpreadsheet, normalize } from "@/lib/spreadsheet-import";
import { buildAccidentImportPreview, commitAccidentImport, type AccidentImportMapping } from "@/server/services/accident-import.service";
import type { CurrentUser } from "@/server/auth/current-user";

/**
 * Rota temporária — desfaz os 230 acidentes importados sem filtro de empresa (apaga só os que
 * têm reportedById = ator sintético do import, nunca toca no acidente que já existia antes) e
 * reimporta só as linhas cuja empresa terceira é Log20/LOG 20. Remover depois de usar.
 */
const TOKEN = "1f6a9c3e0d7b4a8f2c5e9b6d3a0f7c4e1b8d5a2f9c6e3b0d7a4f1c8e5b2d9a6f";

const COLUMN_NAMES = {
  date: "Data em que ocorreu o incidente",
  time: "Hora em que Incidente Ocorreu",
  type: "Classificação de Incidentes",
  area: "Departamento onde ocorreu o incidente",
  description: "Descrição do Incidente pelo Gerente",
  isSif: "Status SIF",
  sifClassification: "Tipo SIF",
  status: "Estado do fluxo de trabalho",
} as const;

const COMPANY_COLUMNS = ["Nome da Empresa Terceira", "Contactor Company Name (Other)"];

function isLog20(value: string): boolean {
  const n = normalize(value);
  return n.includes("log20") || n.includes("log 20") || n === "log20";
}

async function getActorAsCurrentUser(): Promise<CurrentUser> {
  const actor = await db.user.findFirstOrThrow({
    where: { role: { key: "ADMINISTRADOR" }, active: true },
    orderBy: { createdAt: "asc" },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } }, userAreas: true, userFunctions: true },
  });
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    active: actor.active,
    roleId: actor.roleId,
    roleKey: actor.role.key,
    roleName: actor.role.name,
    unitId: actor.unitId,
    permissions: new Set(actor.role.rolePermissions.map((rp) => rp.permission.key)),
    areaIds: new Set(actor.userAreas.map((a) => a.areaId)),
    functionIds: new Set(actor.userFunctions.map((f) => f.functionId)),
    canRollCall: actor.canRollCall,
    rollCallAreaIds: new Set(),
    rollCallTurnoIds: new Set(),
  };
}

function formPage(token: string) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Corrigir importação de acidentes</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 20px;color:#1a1d23}
button{background:#c0392b;color:#fff;border:none;padding:10px 18px;border-radius:6px;font-size:15px;cursor:pointer;margin-top:14px}
input[type=file]{margin-top:10px}
p{color:#5b616e;font-size:14px}</style></head>
<body>
<h2>Apagar e reimportar só Log20/LOG 20</h2>
<p>Isso apaga os 230 acidentes importados sem filtro (não toca no que já existia antes) e reimporta
só as linhas cuja empresa terceira bate com "Log20" ou "LOG 20". Escolhe o mesmo arquivo de antes.</p>
<form method="POST" enctype="multipart/form-data">
  <input type="hidden" name="token" value="${token}" />
  <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
  <br/>
  <button type="submit">Apagar os 230 e reimportar só Log20</button>
</form>
</body></html>`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return new NextResponse(formPage(token), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = formData.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecione um arquivo válido." }, { status: 400 });
  }

  const user = await getActorAsCurrentUser();

  // --- Fase 1: apagar só os acidentes criados pelo import anterior (mesmo ator sintético) ---
  const toDelete = await db.accident.findMany({ where: { reportedById: user.id }, select: { id: true } });
  const idsToDelete = toDelete.map((a) => a.id);
  let deleted = 0;
  if (idsToDelete.length > 0) {
    await db.$transaction([
      db.accidentAction.deleteMany({ where: { accidentId: { in: idsToDelete } } }),
      db.attachment.deleteMany({ where: { accidentId: { in: idsToDelete } } }),
      db.accidentInvolvement.deleteMany({ where: { accidentId: { in: idsToDelete } } }),
      db.accident.deleteMany({ where: { id: { in: idsToDelete } } }),
    ]);
    deleted = idsToDelete.length;
  }

  // --- Fase 2: reimportar só as linhas da Log20/LOG 20 ---
  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = await parseSpreadsheet(buffer, file.name);

  const companyIdxs = COMPANY_COLUMNS.map((name) => headers.indexOf(name)).filter((i) => i >= 0);
  const log20Rows = rows.filter((row) => companyIdxs.some((idx) => isLog20(row[idx] || "")));

  const mapping: AccidentImportMapping = {};
  for (const [field, columnName] of Object.entries(COLUMN_NAMES)) {
    const idx = headers.indexOf(columnName);
    if (idx >= 0) (mapping as Record<string, number>)[field] = idx;
  }

  const preview = await buildAccidentImportPreview(user, log20Rows, mapping);
  const result = await commitAccidentImport(user, preview);

  return NextResponse.json({
    deleted,
    log20RowsFound: log20Rows.length,
    totalRowsInFile: rows.length,
    previewCreate: preview.filter((r) => r.action === "create").length,
    previewErrors: preview.filter((r) => r.action === "error").length,
    result,
  });
}
