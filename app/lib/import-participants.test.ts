import { describe, expect, it } from "vitest";
import { parseParticipantRows } from "./import-participants";

describe("participant spreadsheet parsing", () => {
  it("normalizes valid rows and reports invalid rows without discarding valid data", () => {
    const result = parseParticipantRows([
      { " Nome ": " Ana   Maria ", " E-mail ": " ANA@example.com " },
      { " Nome ": "Sem Email", " E-mail ": "invalido" },
      { " Nome ": "", " E-mail ": "" },
    ]);
    expect(result.valid).toEqual([{ name: "Ana Maria", email: "ana@example.com", row: 2 }]);
    expect(result.errors).toEqual([{ row: 3, message: "E-mail inválido." }]);
    expect(result.ignored).toBe(1);
  });

  it("requires Nome and E-mail columns", () => {
    expect(() => parseParticipantRows([{ Pessoa: "Ana", Contato: "ana@example.com" }])).toThrow(
      "O arquivo precisa conter as colunas Nome e E-mail.",
    );
  });

  it("keeps the last name for duplicate emails", () => {
    const result = parseParticipantRows([
      { Nome: "Ana", Email: "ana@example.com" },
      { Nome: "Ana Maria", Email: "ANA@example.com" },
    ]);
    expect(result.valid).toEqual([{ name: "Ana Maria", email: "ana@example.com", row: 3 }]);
  });
});
