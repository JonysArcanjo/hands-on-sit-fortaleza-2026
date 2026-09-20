import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseParticipantFile } from "./participant-file";

function minimalWorkbook(): ArrayBuffer {
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      </Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      </Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets><sheet name="Participantes" sheetId="1" r:id="rId1"/></sheets>
      </workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
      </Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1"><c r="A1" t="inlineStr"><is><t>Nome</t></is></c><c r="B1" t="inlineStr"><is><t>E-mail</t></is></c></row>
          <row r="2"><c r="A2" t="inlineStr"><is><t>Ana XLSX</t></is></c><c r="B2" t="inlineStr"><is><t>ana.xlsx@example.com</t></is></c></row>
        </sheetData>
      </worksheet>`,
  };
  const archive = zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, strToU8(value)])));
  return archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
}

describe("participant file parsing", () => {
  it("parses quoted CSV fields without splitting embedded commas", async () => {
    const csv = new TextEncoder().encode('Nome,E-mail\r\n"Ana, Maria",ana.csv@example.com\r\n');

    await expect(parseParticipantFile("participantes.csv", csv.buffer)).resolves.toEqual([
      { Nome: "Ana, Maria", "E-mail": "ana.csv@example.com" },
    ]);
  });

  it("parses the first worksheet from a real XLSX container", async () => {
    await expect(parseParticipantFile("participantes.xlsx", minimalWorkbook())).resolves.toEqual([
      { Nome: "Ana XLSX", "E-mail": "ana.xlsx@example.com" },
    ]);
  });

  it("rejects an unsupported extension", async () => {
    await expect(parseParticipantFile("participantes.txt", new ArrayBuffer(0))).rejects.toThrow("Formato incompatível");
  });
});
