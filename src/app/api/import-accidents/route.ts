import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { parseSpreadsheet } from "@/lib/spreadsheet-import";
import { buildAccidentImportPreview, commitAccidentImport, type AccidentImportMapping } from "@/server/services/accident-import.service";
import type { CurrentUser } from "@/server/auth/current-user";

/**
 * Rota temporária — form de upload pra importar a planilha real de acidentes (histórico
 * fornecido pelo usuário), com o mapeamento de colunas já validado localmente contra o arquivo.
 * Remover depois de usar.
 */
const TOKEN = "5e9c2a7f1d4b8e0c3a6f9d2b5e8c1a4f7d0b3e6c9a2f5d8b1e4c7a0f3d6b9e2c";

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
<html lang="pt-BR"><head><meta charset="utf-8"><title>Importar acidentes</title>
<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#1a1d23}
button{background:#0068d8;color:#fff;border:none;padding:10px 18px;border-radius:6px;font-size:15px;cursor:pointer;margin-top:14px}
input[type=file]{margin-top:10px}
p{color:#5b616e;font-size:14px}</style></head>
<body>
<h2>Importar planilha de acidentes</h2>
<p>Escolhe o arquivo .xlsx da planilha de acidentes. O mapeamento de colunas já está configurado pro formato dessa planilha.</p>
<form method="POST" enctype="multipart/form-data">
  <input type="hidden" name="token" value="${token}" />
  <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
  <br/>
  <button type="submit">Importar agora</button>
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = await parseSpreadsheet(buffer, file.name);

  const mapping: AccidentImportMapping = {};
  for (const [field, columnName] of Object.entries(COLUMN_NAMES)) {
    const idx = headers.indexOf(columnName);
    if (idx >= 0) (mapping as Record<string, number>)[field] = idx;
  }

  const user = await getActorAsCurrentUser();
  const preview = await buildAccidentImportPreview(user, rows, mapping);
  const result = await commitAccidentImport(user, preview);

  return NextResponse.json({
    fileHeadersFound: headers.length,
    mappingResolved: mapping,
    totalRows: rows.length,
    previewCreate: preview.filter((r) => r.action === "create").length,
    previewErrors: preview.filter((r) => r.action === "error").length,
    result,
  });
}
