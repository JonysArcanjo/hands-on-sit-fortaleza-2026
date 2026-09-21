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
    expect(result.duplicates).toBe(0);
  });

  it("requires Nome and E-mail columns", () => {
    expect(() => parseParticipantRows([{ Pessoa: "Ana", Contato: "ana@example.com" }])).toThrow(
      "O arquivo precisa conter as colunas Nome e E-mail.",
    );
  });

  it("keeps different registered names that share an email", () => {
    const result = parseParticipantRows([
      { Nome: "João Victor", Email: "arcanjocity@gmail.com" },
      { Nome: "Jonys Arcanjo", Email: "ARCANJOCITY@gmail.com" },
    ]);
    expect(result.valid).toEqual([
      { name: "João Victor", email: "arcanjocity@gmail.com", row: 2 },
      { name: "Jonys Arcanjo", email: "arcanjocity@gmail.com", row: 3 },
    ]);
  });

  it("counts an exact email and name repetition once", () => {
    const result = parseParticipantRows([
      { Nome: "Jonys Arcanjo", Email: "arcanjocity@gmail.com" },
      { Nome: "  JONYS   ARCANJO ", Email: " ARCANJOCITY@gmail.com " },
    ]);
    expect(result.valid).toEqual([{ name: "Jonys Arcanjo", email: "arcanjocity@gmail.com", row: 2 }]);
    expect(result.duplicates).toBe(1);
  });
});
