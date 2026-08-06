import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail, normalizeHeader, normalizeName } from "./participants";

describe("participant normalization", () => {
  it("normalizes imported names, emails and column headers", () => {
    expect(normalizeEmail("  ANA@EXAMPLE.COM ")).toBe("ana@example.com");
    expect(normalizeName("  Ana   Maria ")).toBe("Ana Maria");
    expect(normalizeHeader(" E-mail ")).toBe("email");
    expect(normalizeHeader(" Nôme ")).toBe("nome");
  });

  it("accepts ordinary email addresses and rejects malformed ones", () => {
    expect(isValidEmail("ana.silva+sit@example.com")).toBe(true);
    expect(isValidEmail("ana@localhost")).toBe(false);
    expect(isValidEmail("ana @example.com")).toBe(false);
  });
});
