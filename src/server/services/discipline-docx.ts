import "server-only";
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { buildMeasureDocumentContent, type MeasureDocumentInput } from "@/domain/discipline/document";

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function idRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: BORDERS,
        shading: { fill: "F4F6F8" },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 22 })] })],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        borders: BORDERS,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 22 })] })],
      }),
    ],
  });
}

function signatureLine(label: string) {
  return [
    new Paragraph({ spacing: { before: 700 }, children: [new TextRun({ text: "______________________________________", size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: label, size: 20 })] }),
  ];
}

/** Documento da medida disciplinar (advertência/suspensão) pronto pra imprimir e colher as assinaturas. */
export async function buildMeasureDocx(input: MeasureDocumentInput): Promise<Buffer> {
  const content = buildMeasureDocumentContent(input);
  const doc = new Document({
    creator: "SIGO",
    title: content.title,
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 } } },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 300 },
            children: [new TextRun({ text: content.title, bold: true, size: 30 })],
          }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: content.identification.map(([l, v]) => idRow(l, v)) }),
          ...content.paragraphs.map(
            (text) =>
              new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 240, line: 320 },
                children: [new TextRun({ text, size: 22 })],
              }),
          ),
          new Paragraph({ spacing: { before: 360 }, children: [new TextRun({ text: "Local e data: ____________________, ____/____/________", size: 22 })] }),
          ...signatureLine("Colaborador(a) — ciente"),
          ...signatureLine("Gestor responsável"),
          ...signatureLine("Recursos Humanos"),
          new Paragraph({ spacing: { before: 500 }, children: [new TextRun({ text: "Testemunhas (se o(a) colaborador(a) se recusar a assinar):", bold: true, size: 20 })] }),
          ...signatureLine("Testemunha 1 — nome e CPF"),
          ...signatureLine("Testemunha 2 — nome e CPF"),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
