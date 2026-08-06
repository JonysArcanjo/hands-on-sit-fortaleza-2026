import { isValidEmail, normalizeEmail, normalizeHeader, normalizeName } from "./participants";

export type ImportedParticipant = { name: string; email: string; row: number };
export type ImportResult = {
  valid: ImportedParticipant[];
  errors: { row: number; message: string }[];
  ignored: number;
};

export function parseParticipantRows(rows: Record<string, unknown>[]): ImportResult {
  if (rows.length === 0) return { valid: [], errors: [], ignored: 0 };
  const headers = Object.keys(rows[0]).reduce<Record<string, string>>((map, header) => {
    map[normalizeHeader(header)] = header;
    return map;
  }, {});
  const nameHeader = headers.nome;
  const emailHeader = headers.email;
  if (!nameHeader || !emailHeader) {
    throw new Error("O arquivo precisa conter as colunas Nome e E-mail.");
  }

  const byEmail = new Map<string, ImportedParticipant>();
  const errors: ImportResult["errors"] = [];
  let ignored = 0;
  rows.forEach((row, index) => {
    const line = index + 2;
    const name = normalizeName(String(row[nameHeader] ?? ""));
    const email = normalizeEmail(String(row[emailHeader] ?? ""));
    if (!name && !email) {
      ignored += 1;
      return;
    }
    if (!name) {
      errors.push({ row: line, message: "Nome obrigatório." });
      return;
    }
    if (!isValidEmail(email)) {
      errors.push({ row: line, message: "E-mail inválido." });
      return;
    }
    byEmail.set(email, { name, email, row: line });
  });

  return { valid: [...byEmail.values()], errors, ignored };
}
