import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  CLASSIFICATION_LABELS,
  FORM_REVISION,
  YES_NO_LABELS,
  type Classification,
  type EmployeeAnswers,
  type Evaluation,
} from "@/domain/absence-interview/form";
import type { InterviewDetail } from "@/server/services/absence-interview.service";

const NOTE_STATUS_LABEL: Record<string, string> = { FALTA: "Falta", ATESTADO: "Atestado" };

function yn(value: "SIM" | "NAO" | undefined | null) {
  return value ? YES_NO_LABELS[value] : "—";
}

function dateFromKey(key: string | undefined | null) {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return formatDate(new Date(y, m - 1, d, 12));
}

function section(title: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    shading: { fill: "E8EEF5" },
    children: [new TextRun({ text: title, bold: true, size: 24 })],
  });
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function row(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 38, type: WidthType.PERCENTAGE },
        borders: BORDERS,
        shading: { fill: "F4F6F8" },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
      }),
      new TableCell({
        width: { size: 62, type: WidthType.PERCENTAGE },
        borders: BORDERS,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: value
          .split("\n")
          .map((line) => new Paragraph({ children: [new TextRun({ text: line || "—", size: 20 })] })),
      }),
    ],
  });
}

function table(rows: [string, string][]) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map(([l, v]) => row(l, v)) });
}

function signature(label: string) {
  return new Paragraph({
    spacing: { before: 700 },
    children: [new TextRun({ text: `______________________________________\n${label}`, size: 20 })],
  });
}

/** Gera o .docx da entrevista no layout do modelo Rev 03/24 (pronto pra imprimir e coletar assinaturas). */
export async function buildInterviewDocx(interview: InterviewDetail): Promise<Buffer> {
  const a = (interview.answers ?? null) as EmployeeAnswers | null;
  const ev = (interview.evaluation ?? null) as Evaluation | null;
  const noteLabel = NOTE_STATUS_LABEL[interview.note.status ?? ""] ?? interview.note.status ?? "Ausência";

  const doc = new Document({
    creator: "SIGO",
    title: `Entrevista de Absenteísmo — ${interview.collaborator.name}`,
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: `ENTREVISTA DE ABSENTEÍSMO - ${FORM_REVISION}`, bold: true, size: 32 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Aplicação: imediatamente após o retorno ao trabalho · Responsável: Área de Gente ou Liderança Imediata",
                size: 18,
                color: "555555",
              }),
            ],
          }),

          section("1 - IDENTIFICAÇÃO DO COLABORADOR"),
          table([
            ["Colaborador", interview.collaborator.name],
            ["Matrícula", interview.collaborator.matricula ?? "—"],
            ["Área", interview.collaborator.area?.name ?? "—"],
            ["Função", interview.collaborator.function?.name ?? "—"],
          ]),

          section("2 - DETALHAMENTO DA(S) FALTA(S)"),
          table([
            ["Ausência registrada no SIGO", `${noteLabel} em ${formatDate(interview.note.date)}`],
            ["Data de início da ausência", dateFromKey(ev?.startDate)],
            ["Data final da ausência", dateFromKey(ev?.endDate)],
            ["Ocorrência de falta(s) anterior(es) sem justificativa", yn(ev?.priorUnjustified)],
            ["Comunicação prévia desta(s) falta(s) à empresa", yn(ev?.communicatedBefore)],
            ["Apresentação de justificativa compatível", yn(ev?.presentedJustification)],
            ["Relato do colaborador (o que aconteceu)", a?.description ?? "—"],
            [
              "Preenchido por",
              interview.answeredAt
                ? `${interview.filledByHr ? "RH (em nome do colaborador)" : "O próprio colaborador"} em ${formatDateTime(interview.answeredAt)}`
                : "—",
            ],
          ]),

          section("3 - CLASSIFICAÇÃO DAS FALTAS"),
          table([
            ["Classificação", ev ? CLASSIFICATION_LABELS[ev.classification as Classification] : "—"],
            ["Classificação detalhada", ev?.detail ?? "—"],
            ...(ev?.healthProblem ? ([["Problema de saúde relatado", ev.healthProblem]] as [string, string][]) : []),
            ...(ev?.crm ? ([["CRM do médico / CRO do dentista", ev.crm]] as [string, string][]) : []),
            ...(ev?.cid ? ([["CID do atestado", ev.cid]] as [string, string][]) : []),
          ]),

          section("4 - AÇÃO TOMADA"),
          table([
            ["Ação tomada após a classificação", ev?.actionTaken ?? "—"],
            ["Justificativa para a falta acatada pela empresa", yn(ev?.excuseAccepted)],
            ["Dia de trabalho descontado", yn(ev?.dayDiscounted)],
            ["Falta poderia ter sido evitada através de folga alinhada", yn(ev?.avoidableByDayOff)],
          ]),

          section("5 - ANÁLISE 5 PORQUÊS"),
          table(
            [0, 1, 2, 3, 4].map((i) => [`${i + 1}. Por quê?`, a?.fiveWhys?.[i] || "—"] as [string, string]),
          ),
          new Paragraph({ spacing: { before: 160 }, children: [] }),
          table([
            ["Comentários adicionais — Gente e Gestão", ev?.hrComments || "—"],
            ["Comentários adicionais — Liderança", ev?.leadershipComments || "—"],
          ]),

          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: interview.concludedAt
                  ? `Avaliação concluída por ${interview.concludedBy?.name ?? "—"} em ${formatDateTime(interview.concludedAt)}.`
                  : "Avaliação ainda não concluída.",
                size: 18,
                color: "555555",
              }),
            ],
          }),

          signature("Colaborador"),
          signature("Entrevistador (Gente / Liderança imediata)"),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
