import { describe, expect, it } from "vitest";
import { buildRegistrationsCsv } from "./registrations-csv";

describe("registrations CSV", () => {
  it("exports grouped registration data and escapes commas and quotes", () => {
    const csv = buildRegistrationsCsv([
      { workshop: "Clean Core, na prática", name: 'Ana "Bia"', email: "ana@example.com", createdAt: "2026-08-25 13:29:53" },
    ]);

    expect(csv).toBe('\uFEFFHands-on,Nome,E-mail,Data da inscrição\r\n"Clean Core, na prática","Ana ""Bia""",ana@example.com,2026-08-25 13:29:53');
  });
});
