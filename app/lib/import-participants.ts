import { isValidEmail, normalizeEmail, normalizeHeader, normalizeName } from "./participants";
import { participantNameKey } from "../../db/participant-identity";

export type ImportedParticipant = { name: string; email: string; row: number };
export type ImportResult = {
  valid: ImportedParticipant[];
  errors: { row: number; message: string }[];
  ignored: number;
  duplicates: number;
};

export function parseParticipantRows(rows: Record<string, unknown>[]): ImportResult {
  if (rows.length === 0) return { valid: [], errors: [], ignored: 0, duplicates: 0 };
  const headers = Object.keys(rows[0]).reduce<Record<string, string>>((map, header) => {
    map[normalizeHeader(header)] = header;
    return map;
  }, {});
  const nameHeader = headers.nome;
  const emailHeader = headers.email;
  if (!nameHeader || !emailHeader) {
    throw new Error("O arquivo precisa conter as colunas Nome e E-mail.");
  }

  const byIdentity = new Map<string, ImportedParticipant>();
  const errors: ImportResult["errors"] = [];
  let ignored = 0;
  let duplicates = 0;
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
    const identity = `${email}\0${participantNameKey(name)}`;
    if (byIdentity.has(identity)) {
      duplicates += 1;
      return;
    }
    byIdentity.set(identity, { name, email, row: line });
  });

  return { valid: [...byIdentity.values()], errors, ignored, duplicates };
}
