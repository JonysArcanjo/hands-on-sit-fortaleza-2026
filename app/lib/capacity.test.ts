import { describe, expect, it } from "vitest";
import { availability, validateCapacity } from "./capacity";

describe("workshop capacity", () => {
  it("reports sold out only when registrations reach capacity", () => {
    expect(availability(20, 19)).toBe("available");
    expect(availability(20, 20)).toBe("sold-out");
    expect(availability(20, 21)).toBe("sold-out");
  });

  it("rejects non-positive capacity and reductions below enrollment", () => {
    expect(validateCapacity(0, 0)).toEqual({ ok: false, message: "A capacidade deve ser maior que zero." });
    expect(validateCapacity(9, 10)).toEqual({ ok: false, message: "A capacidade não pode ser menor que as inscrições atuais." });
    expect(validateCapacity(10, 10)).toEqual({ ok: true });
  });
});
