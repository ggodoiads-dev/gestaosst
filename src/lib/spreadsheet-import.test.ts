import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseSpreadsheet } from "./spreadsheet-import";

const NS = 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const text = (t: string) => `<x:c t="inlineStr"><x:is><x:t>${t}</x:t></x:is></x:c>`;
const num = (v: string) => `<x:c><x:v>${v}</x:v></x:c>`;

describe("parseSpreadsheet com .xlsx de exportação de BI (elementos com prefixo x:, texto em linha)", () => {
  it("lê cabeçalho, números e células vazias", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
    zip.file("xl/workbook.xml", `<x:workbook ${NS}><x:sheets><x:sheet name="Export" sheetId="1"/></x:sheets></x:workbook>`);
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<x:worksheet ${NS}><x:sheetData>` +
        `<x:row>${text("CATEGORIA")}${text("SATISFAÇÃO")}${text("ITENS")}</x:row>` +
        `<x:row>${text("A &amp; B")}${num("0.5")}<x:c /></x:row>` +
        `<x:row>${text("C")}${num("0.25")}${num("0.1")}</x:row>` +
        `</x:sheetData></x:worksheet>`,
    );
    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
    const { headers, rows } = await parseSpreadsheet(buffer, "export.xlsx");
    expect(headers).toEqual(["CATEGORIA", "SATISFAÇÃO", "ITENS"]);
    expect(rows).toEqual([
      ["A & B", "0.5", ""],
      ["C", "0.25", "0.1"],
    ]);
  });
});
