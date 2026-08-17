import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/server/auth/current-user";
import { getMonthlyBenefits } from "@/server/services/benefits.service";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const now = new Date();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  const year = Number(searchParams.get("year")) || now.getFullYear();

  let benefits: Awaited<ReturnType<typeof getMonthlyBenefits>>;
  try {
    benefits = await getMonthlyBenefits(user, { month, year });
  } catch {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${MONTH_LABELS[month - 1]} ${year}`);
  sheet.columns = [
    { header: "Colaborador", key: "name", width: 32 },
    { header: "Matrícula", key: "matricula", width: 14 },
    { header: "Dias programados (mês cheio)", key: "scheduledDays", width: 22 },
    { header: "Faltas injustificadas (apuração)", key: "unjustifiedFaltas", width: 24 },
    { header: "Dias de benefício", key: "benefitDays", width: 16 },
    { header: "Advertência na apuração", key: "hasWarning", width: 20 },
    { header: "Cesta básica", key: "cestaBasica", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const b of benefits) {
    sheet.addRow({
      name: b.collaboratorName,
      matricula: b.matricula ?? "",
      scheduledDays: b.scheduledDays,
      unjustifiedFaltas: b.unjustifiedFaltas,
      benefitDays: b.benefitDays,
      hasWarning: b.hasWarning ? "Sim" : "Não",
      cestaBasica: b.cestaBasica ? "Tem direito" : "Perdeu",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="beneficios-${MONTH_LABELS[month - 1].toLowerCase()}-${year}.xlsx"`,
    },
  });
}
