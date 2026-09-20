import { readSheet } from "read-excel-file/node";

function rowsToRecords(rows: readonly (readonly unknown[])[]): Record<string, unknown>[] {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];
  const headers = headerRow.map((value, index) => {
    const header = String(value ?? "");
    return index === 0 ? header.replace(/^\uFEFF/, "") : header;
  });
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (quoted || field.length === 0) {
        quoted = !quoted;
      } else {
        field += character;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("O arquivo CSV contém aspas não fechadas.");
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export async function parseParticipantFile(fileName: string, contents: ArrayBuffer): Promise<Record<string, unknown>[]> {
  if (/\.csv$/i.test(fileName)) {
    return rowsToRecords(parseCsv(new TextDecoder().decode(contents)));
  }
  if (/\.xlsx$/i.test(fileName)) {
    const rows = await readSheet(Buffer.from(contents));
    return rowsToRecords(rows);
  }
  throw new Error("Formato incompatível. Envie CSV ou XLSX.");
}
